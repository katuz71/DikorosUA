import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("POSTGRES_USER", "postgres")
    DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
    DB_HOST = os.getenv("POSTGRES_HOST", "db")
    DB_NAME = os.getenv("POSTGRES_DB", "postgres")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

def analyze_db():
    print("Подключаемся к базе...\n")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # 1. Смотрим, сколько вообще товаров в базе
        cur.execute("SELECT COUNT(*) FROM products;")
        total = cur.fetchone()[0]
        print(f"📦 Всего товаров в базе сейчас: {total}")
        
        # 2. Вытаскиваем последние 5 добавленных товаров (твой тестовый точно там!)
        print("\n🔍 Последние 5 добавленных товаров:")
        cur.execute("SELECT id, name, image FROM products ORDER BY id DESC LIMIT 5;")
        for row in cur.fetchall():
            print(f"ID: {row[0]} | Имя: {row[1][:30]}... | Ссылка на фото: {row[2]}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    analyze_db()