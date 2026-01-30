import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Обновляем цену для 200 грам 1 сорта
cursor.execute("""
UPDATE products 
SET price = 1900 
WHERE id IN (353, 354)
""")

conn.commit()

# Проверяем
cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE id IN (353, 354)
""")

rows = cursor.fetchall()
print("=== Обновленные цены для 200 грам ===\n")
for r in rows:
    print(f"ID: {r[0]}, Price: {r[2]} грн")
    print(f"Name: {r[1]}\n")

conn.close()
print("✅ Цены обновлены на 1900 грн")
