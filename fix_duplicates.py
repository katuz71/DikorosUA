import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Варианты без сорта, которые дублируют варианты с сортом
duplicates = [80, 81, 86, 87, 141, 142]

print("🗑️ Удаляем дубликаты без сорта:")
for dup_id in duplicates:
    cursor.execute('SELECT id, name, price FROM products WHERE id = ?', (dup_id,))
    row = cursor.fetchone()
    if row:
        print(f"  ID {row[0]}: {row[1][:60]}... | {row[2]} грн")

# Удаляем
cursor.execute('DELETE FROM products WHERE id IN (?, ?, ?, ?, ?, ?)', tuple(duplicates))
conn.commit()

print(f"\n✅ Удалено {cursor.rowcount} дубликатов")

# Проверяем что осталось для мухомора
cursor.execute("""
    SELECT id, name, price FROM products 
    WHERE name LIKE '%мухомору червоного%' 
    AND name LIKE '%Шляпки%'
    ORDER BY price
""")
rows = cursor.fetchall()

print(f"\n📋 Осталось {len(rows)} вариантов мухомора червоного:")
for row in rows:
    print(f"  ID {row[0]:3d}: {row[1][:60]:<60} | {row[2]:5.0f} грн")

conn.close()
print("\n✅ БД очищена от дубликатов!")
