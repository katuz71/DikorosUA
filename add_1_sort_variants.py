import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Проверяем максимальный ID
cursor.execute('SELECT MAX(id) FROM products')
max_id = cursor.fetchone()[0]
print(f"Максимальный ID в БД: {max_id}")

# Проверяем есть ли уже варианты 349-354
cursor.execute('SELECT COUNT(*) FROM products WHERE id BETWEEN 349 AND 354')
existing = cursor.fetchone()[0]
print(f"Существующих вариантов 349-354: {existing}")

if existing > 0:
    print("Варианты уже существуют, удаляем...")
    cursor.execute('DELETE FROM products WHERE id BETWEEN 349 AND 354')
    conn.commit()

# Получаем данные базового варианта для копирования
cursor.execute("""
    SELECT category, image, description
    FROM products 
    WHERE id = 75
""")
base_data = cursor.fetchone()
category, image, description = base_data

print(f"\nДобавляем 6 новых вариантов '1 сорт':")

variants = [
    (349, "Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 50 грам", 500),
    (350, "Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 50 грам", 500),
    (351, "Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 100 грам", 1000),
    (352, "Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 100 грам", 1000),
    (353, "Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 200 грам", 1900),
    (354, "Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 200 грам", 1900),
]

for variant_id, name, price in variants:
    cursor.execute("""
        INSERT INTO products (id, name, price, category, image, description)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (variant_id, name, price, category, image, description))
    print(f"  ✅ ID {variant_id}: {name[:60]}... -> {price} грн")

conn.commit()

# Проверяем результат
cursor.execute('SELECT id, name, price FROM products WHERE id BETWEEN 349 AND 354 ORDER BY id')
rows = cursor.fetchall()
print(f"\n✅ Добавлено {len(rows)} вариантов:")
for row in rows:
    print(f"  ID {row[0]}: {row[1][:60]}... -> {row[2]} грн")

conn.close()
print("\n✅ БД обновлена успешно!")
