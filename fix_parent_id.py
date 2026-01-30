import sqlite3

conn = sqlite3.connect('services/shop.db')
cursor = conn.cursor()

# Обновляем parent_id для новых вариантов
cursor.execute("""
UPDATE products 
SET parent_id = 77 
WHERE id BETWEEN 349 AND 354
""")

conn.commit()

# Проверяем
cursor.execute('SELECT id, name, parent_id FROM products WHERE id BETWEEN 349 AND 354')
rows = cursor.fetchall()
print('Обновленные варианты:')
for r in rows:
    print(f'ID {r[0]}, parent_id: {r[2]}, name: {r[1][:60]}...')

conn.close()
print('\n✅ parent_id обновлен на 77 для всех новых вариантов')
