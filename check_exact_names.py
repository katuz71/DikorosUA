import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE id IN (75, 76, 77, 78)
ORDER BY id
""")

rows = cursor.fetchall()
print("=== Точные названия товаров ===\n")
for row in rows:
    print(f"ID: {row[0]}")
    print(f"Price: {row[1]} грн")
    print(f"Name: {row[2]}")
    print()

conn.close()
