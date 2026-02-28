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

def find_truth():
    print("Подключаемся к базе...\n")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Выводим 10 товаров по алфавиту, чтобы увидеть "клонов" рядом
        print("👯‍♂️ ПРОВЕРКА ДУБЛЕЙ (10 товаров по алфавиту):")
        cur.execute("SELECT id, name FROM products ORDER BY name LIMIT 10;")
        for row in cur.fetchall():
            print(f"ID: {row[0]} | Имя: {row[1]}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    find_truth()