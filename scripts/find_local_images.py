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

def find_images():
    print("Ищем локальные картинки...\n")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Ищем товары, где картинка не NULL и не начинается с http
        cur.execute("""
            SELECT id, name, image 
            FROM products 
            WHERE image IS NOT NULL AND image NOT LIKE 'http%' 
            ORDER BY id DESC LIMIT 5;
        """)
        rows = cur.fetchall()
        
        if not rows:
            print("🤷‍♂️ В базе НЕТ ни одной локальной картинки. Похоже, админка их не сохраняет!")
        else:
            for row in rows:
                print(f"ID: {row[0]} | Имя: {row[1]} | Картинка: {row[2]}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    find_images()