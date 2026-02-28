import psycopg2
import os
from dotenv import load_dotenv

# Загружаем переменные из .env
load_dotenv()

# Собираем строку подключения к базе
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("POSTGRES_USER", "postgres")
    DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
    DB_HOST = os.getenv("POSTGRES_HOST", "db") 
    DB_NAME = os.getenv("POSTGRES_DB", "postgres")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

def remove_duplicates():
    print("Подключаемся к базе данных...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # SQL-запрос: удаляем дубли по ИМЕНИ (name), игнорируя лишние пробелы (TRIM)
        query = """
        DELETE FROM products 
        WHERE id IN (
            SELECT id FROM (
                SELECT id, row_number() OVER (PARTITION BY TRIM(name) ORDER BY id DESC) as rn 
                FROM products
            ) t WHERE t.rn > 1
        );
        """
        
        cur.execute(query)
        deleted_count = cur.rowcount
        conn.commit()
        
        print(f"✅ Готово! Успешно удалено дубликатов: {deleted_count}")
        
    except Exception as e:
        print(f"❌ Ошибка базы данных: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    remove_duplicates()