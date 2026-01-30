import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Ищем все варианты с сортами
cursor.execute("""
    SELECT id, name, price 
    FROM products 
    WHERE name LIKE '%сорт%'
    ORDER BY id
""")

rows = cursor.fetchall()
print(f"Найдено {len(rows)} вариантов с сортами:\n")

for row in rows:
    print(f"ID {row[0]:3d}: {row[1][:70]:<70} -> {row[2]:5.0f} грн")

conn.close()
