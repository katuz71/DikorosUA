# -*- coding: utf-8 -*-
"""
Удаляет дубликаты товаров в таблице products (оставляем запись с минимальным id в группе).
"""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required.")

conn = psycopg2.connect(DATABASE_URL)
try:
    cur = conn.cursor()

    # Выбираем колонку для группировки: article -> horoshop_id -> name
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'products' AND column_name IN ('article', 'horoshop_id', 'name')
    """)
    present = {row[0] for row in cur.fetchall()}
    if "article" in present:
        group_by = "article"
    elif "horoshop_id" in present:
        group_by = "horoshop_id"
    else:
        group_by = "name"

    sql = f"""
        DELETE FROM products
        WHERE id NOT IN (SELECT MIN(id) FROM products GROUP BY {group_by})
    """
    cur.execute(sql)
    deleted = cur.rowcount
    conn.commit()
    print(f"Группировка по: {group_by}. Удалено строк: {deleted}")
finally:
    conn.close()
