# -*- coding: utf-8 -*-
"""
Добавляет колонки лент товаров в таблицу products:
- is_bestseller (Хиты продаж)
- is_promotion (Акции)
- is_new (Новинки)

Запуск: из корня проекта с установленным DATABASE_URL:
  python scripts/migrate_product_ribbons.py
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
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE")
    conn.commit()
    print("Columns is_bestseller, is_promotion, is_new added (or already exist).")
finally:
    conn.close()
