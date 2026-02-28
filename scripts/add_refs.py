# -*- coding: utf-8 -*-
"""
Добавляет колонки city_ref и warehouse_ref в таблицу orders.
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
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS city_ref VARCHAR(255);")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_ref VARCHAR(255);")
    conn.commit()
    print("Columns city_ref and warehouse_ref added (or already exist).")
finally:
    conn.close()
