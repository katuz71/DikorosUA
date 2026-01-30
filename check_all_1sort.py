import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Ищем все варианты с "1" и "сорт"
cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND (name LIKE '%1 сорт%' OR name LIKE '%1сорт%')
ORDER BY price
""")

rows = cursor.fetchall()

print(f"=== Все варианты с '1 сорт' или '1сорт' ({len(rows)}) ===\n")

for r in rows:
    print(f"ID: {r[0]:3} | Price: {r[2]:5} грн | {r[1]}")

conn.close()
