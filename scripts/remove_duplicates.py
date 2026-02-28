# -*- coding: utf-8 -*-
"""
Удаляет дубликаты товаров в таблице products по полю name.
Оставляет запись с минимальным id в каждой группе одинаковых name.
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
    cur.execute("""
        DELETE FROM products a
        USING products b
        WHERE a.id > b.id AND a.name = b.name
    """)
    deleted = cur.rowcount
    conn.commit()
    print(f"Удалено строк: {deleted}")
finally:
    conn.close()
