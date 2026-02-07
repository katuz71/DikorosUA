import sqlite3
import json

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

cursor.execute("SELECT id, name, price, variants FROM products WHERE id = 4157")
result = cursor.fetchone()

if result:
    print(f"ID: {result[0]}")
    print(f"Name: {result[1]}")
    print(f"Price: {result[2]}")
    print(f"Variants (raw): {repr(result[3])}")
    
    if result[3]:
        try:
            v = json.loads(result[3])
            print(f"\nParsed variants: {json.dumps(v, ensure_ascii=False, indent=2)}")
        except Exception as e:
            print(f"Parse error: {e}")
else:
    print("Product not found")

conn.close()
