import psycopg2
import re

DB_URL = "postgresql://postgres:postgres@db:5432/app_db"

def clean_title(title):
    # Вирізаємо небезпечні слова (незалежно від регістру)
    new_title = re.sub(r'(?i)\s*Імунітет\+', '', title)
    new_title = re.sub(r'(?i)\s*Антипухлина', '', new_title)
    new_title = re.sub(r'(?i)\s*Stop Паразит', '', new_title)
    new_title = re.sub(r'(?i)\s*нормалізатор тиску', ' збір (гармонія)', new_title)
    
    # Замінюємо занадто гучні обіцянки на більш м'які
    new_title = re.sub(r'(?i)Омолоджуючий', 'Відновлюючий', new_title)
    
    # Прибираємо зайві пробіли, які могли залишитися після вирізання слів
    new_title = re.sub(r'\s+', ' ', new_title).strip()
    return new_title

def run_update():
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        cur.execute("SELECT id, name FROM products")
        products = cur.fetchall()
        
        updated_count = 0
        print("\n=== РЕЗУЛЬТАТИ ОЧИЩЕННЯ ЗАГОЛОВКІВ ===")
        for pid, name in products:
            new_name = clean_title(name)
            if new_name != name:
                cur.execute("UPDATE products SET name = %s WHERE id = %s", (new_name, pid))
                updated_count += 1
                print(f"❌ Було:  {name}")
                print(f"✅ Стало: {new_name}\n")

        conn.commit()
        cur.close()
        print(f"✅ ГОТОВО! Виправлено заголовків: {updated_count} шт.")
    except Exception as e:
        print(f"❌ Помилка: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    run_update()
