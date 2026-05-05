import psycopg2

DB_URL = "postgresql://postgres:postgres@db:5432/app_db"

def get_remaining():
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        # Ищем всё, что не Мухомор, не Ежовик и не Кордицепс
        cur.execute("""
            SELECT DISTINCT name 
            FROM products 
            WHERE name NOT ILIKE '%Мухомор%' 
              AND name NOT ILIKE '%Їжовик%' 
              AND name NOT ILIKE '%Кордицепс%';
        """)
        
        rows = cur.fetchall()
        print("\n=== ОСТАВШИЕСЯ ТОВАРЫ ===")
        for row in rows:
            print(f"- {row[0]}")
        print("=========================\n")
        
        cur.close()
    except Exception as e:
        print(f"Ошибка: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    get_remaining()
