import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

query = """
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор%' AND name LIKE '%сорт%' 
ORDER BY name
"""

cursor.execute(query)
rows = cursor.fetchall()

print("=== Варианты мухомора с сортом ===\n")
for row in rows:
    print(f"ID: {row[0]}, Price: {row[2]} грн, Name: {row[1]}")

print("\n=== Группировка по сорту ===")
sort_1 = [r for r in rows if '1 сорт' in r[1] or '1сорт' in r[1]]
sort_2 = [r for r in rows if '2 сорт' in r[1] or '2сорт' in r[1]]

print(f"\n1 сорт ({len(sort_1)} товаров):")
for r in sort_1:
    print(f"  ID: {r[0]}, Price: {r[2]} грн")

print(f"\n2 сорт ({len(sort_2)} товаров):")
for r in sort_2:
    print(f"  ID: {r[0]}, Price: {r[2]} грн")

conn.close()
