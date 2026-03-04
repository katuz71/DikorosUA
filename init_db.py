"""
Скрипт инициализации/миграции схемы БД (PostgreSQL).
Использует DATABASE_URL из .env.
Добавляет в таблицу products колонки is_bestseller, is_promotion, is_new при их отсутствии.
Запуск: python init_db.py
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required. Set it in .env")

def init_product_ribbon_columns():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE")
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Колонки is_bestseller, is_promotion, is_new добавлены или уже существуют.")

if __name__ == "__main__":
    init_product_ribbon_columns()
