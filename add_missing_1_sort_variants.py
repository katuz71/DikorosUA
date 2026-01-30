import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ДОДАВАННЯ ВІДСУТНІХ ВАРІАНТІВ 1 СОРТУ")
print("="*80)

# Отримуємо group_id для шляпок мухомора
cursor.execute("""
    SELECT DISTINCT group_id 
    FROM products 
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%1 сорт%'
    LIMIT 1
""")
result = cursor.fetchone()
group_id = result[0] if result else 25459

print(f"\nGroup ID: {group_id}")

# Отримуємо максимальний ID
cursor.execute("SELECT MAX(id) FROM products")
max_id = cursor.fetchone()[0]
print(f"Максимальний ID: {max_id}")

# Варіанти для додавання
new_variants = [
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 50 грам',
        'price': 500.0,
        'weight': '50г'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 50 грам',
        'price': 500.0,
        'weight': '50г'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 100 грам',
        'price': 1000.0,
        'weight': '100г'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 100 грам',
        'price': 1000.0,
        'weight': '100г'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 200 грам',
        'price': 1900.0,
        'weight': '200г'
    },
    {
        'name': 'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 200 грам',
        'price': 1900.0,
        'weight': '200г'
    },
]

# Отримуємо зразок для копіювання інших полів
cursor.execute("""
    SELECT category, image, picture, image_url, vendor_code
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%1 сорт%'
    LIMIT 1
""")
sample = cursor.fetchone()
category, image, picture, image_url, vendor_code = sample if sample else ('Сушені гриби', '', '', '', '')

print(f"\nДодаємо {len(new_variants)} нових варіантів:\n")

new_id = max_id + 1
for variant in new_variants:
    cursor.execute("""
        INSERT INTO products (id, group_id, name, price, category, image, picture, image_url, vendor_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        new_id,
        group_id,
        variant['name'],
        variant['price'],
        category,
        image,
        picture,
        image_url,
        vendor_code
    ))
    
    print(f"✅ [{new_id}] {variant['name'][:60]}... - {variant['price']} UAH")
    new_id += 1

conn.commit()

# Перевіряємо результат
print("\n" + "="*80)
print("ПЕРЕВІРКА: ВСІ ВАРІАНТИ 1 СОРТУ")
print("="*80)

cursor.execute("""
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%1 сорт%'
    ORDER BY price
""")

for pid, name, price in cursor.fetchall():
    print(f"[{pid}] {name[:70]}... - {price} UAH")

conn.close()

print("\n" + "="*80)
print("✅ ГОТОВО! Додано 6 нових варіантів 1 сорту")
print("="*80)
