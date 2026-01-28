import sqlite3

def check_tea():
    try:
        conn = sqlite3.connect('shop.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        print("--- SEARCHING FOR 'чай' ---")
        cur.execute("SELECT id, name, description, price FROM products")
        all_products = cur.fetchall()
        
        found_count = 0
        for p in all_products:
            name = p['name']
            desc = p['description']
            
            # Простой вывод всех названий для проверки
            # print(f"DEBUG PRODUCT: {name}")
            
            if 'чай' in name.lower() or (desc and 'чай' in desc.lower()):
                print(f"✅ FOUND: ID={p['id']}")
                print(f"   Name: {name}")
                print(f"   Desc: {desc}")
                print("-" * 20)
                found_count += 1
                
        print(f"Total found: {found_count}")
        print(f"Total products in DB: {len(all_products)}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tea()
