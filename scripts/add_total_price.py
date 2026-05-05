# -*- coding: utf-8 -*-
"""
Добавляет колонку total_price в таблицу orders.
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
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2);")
    conn.commit()
    print("Column total_price added (or already exists).")
finally:
    conn.close()
