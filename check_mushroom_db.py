import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

cursor.execute("""
    SELECT id, name FROM products 
    WHERE name LIKE '%мухомору червоного%' 
    AND name LIKE '%Шляпки%'
    ORDER BY id
""")
rows = cursor.fetchall()

print(f"Всего вариантов мухомора в БД: {len(rows)}\n")

for row in rows:
    print(f"ID {row[0]:3d}: {row[1]}")

conn.close()
