import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Проверяем какие варианты уже есть
cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%1 сорт%'
ORDER BY name
""")

existing = cursor.fetchall()
print("=== Существующие варианты 1 сорта ===")
for row in existing:
    print(f"ID: {row[0]}, Price: {row[1]} грн, Name: {row[2]}")

# Получаем базовый товар для копирования данных
cursor.execute("""
SELECT * FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%1 сорт%' AND name LIKE '%1 грам%'
LIMIT 1
""")

base_product = cursor.fetchone()
if not base_product:
    print("\n❌ Базовый товар не найден!")
    conn.close()
    exit(1)

print(f"\n=== Базовый товар ===")
print(f"ID: {base_product[0]}")
print(f"Name: {base_product[1]}")
print(f"Category: {base_product[3]}")

# Варианты для добавления
new_variants = [
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 50 грам',
        'price': 500,
        'weight': '50 грам'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 50 грам',
        'price': 500,
        'weight': '50 грам',
        'form': 'порошок'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 100 грам',
        'price': 1000,
        'weight': '100 грам'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 100 грам',
        'price': 1000,
        'weight': '100 грам',
        'form': 'порошок'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 200 грам',
        'price': 2000,
        'weight': '200 грам'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 200 грам',
        'price': 2000,
        'weight': '200 грам',
        'form': 'порошок'
    }
]

print("\n=== Добавляем новые варианты ===")

for variant in new_variants:
    # Проверяем, не существует ли уже такой товар
    cursor.execute("SELECT id FROM products WHERE name = ?", (variant['name'],))
    existing_product = cursor.fetchone()
    
    if existing_product:
        print(f"⚠️  Уже существует: {variant['name']}")
        continue
    
    # Вставляем новый товар
    cursor.execute("""
    INSERT INTO products (name, price, category, description, image, unit)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        variant['name'],
        variant['price'],
        base_product[3],  # category
        base_product[4],  # description
        base_product[5],  # image
        base_product[6]   # unit
    ))
    
    print(f"✅ Добавлено: {variant['name']} - {variant['price']} грн")

conn.commit()

# Проверяем результат
cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%1 сорт%'
ORDER BY price
""")

all_variants = cursor.fetchall()
print(f"\n=== Все варианты 1 сорта ({len(all_variants)}) ===")
for row in all_variants:
    print(f"ID: {row[0]}, Price: {row[1]} грн, Name: {row[2]}")

conn.close()
print("\n✅ Готово!")
