import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Получаем базовый товар
cursor.execute("SELECT * FROM products WHERE id = 75")
columns = [description[0] for description in cursor.description]
base_product = cursor.fetchone()

print("=== Структура таблицы ===")
for i, col in enumerate(columns):
    print(f"{i}: {col} = {base_product[i]}")

print("\n=== Базовый товар ===")
print(f"ID: {base_product[0]}")
print(f"Name: {base_product[1]}")
print(f"Price: {base_product[2]}")
print(f"Category: {base_product[3]}")

# Варианты для добавления (1 сорт: 10 грн за 1 грам)
new_variants = [
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 50 грам', 500),
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 50 грам', 500),
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 100 грам', 1000),
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 100 грам', 1000),
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 200 грам', 2000),
    ('Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 200 грам', 2000),
]

print("\n=== Добавляем новые варианты ===")

for name, price in new_variants:
    # Проверяем существование
    cursor.execute("SELECT id FROM products WHERE name = ?", (name,))
    if cursor.fetchone():
        print(f"⚠️  Уже существует: {name}")
        continue
    
    # Вставляем
    cursor.execute("""
    INSERT INTO products (name, price, category, description, image, unit)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        name,
        price,
        base_product[3],  # category
        base_product[4],  # description
        base_product[5],  # image
        base_product[6]   # unit
    ))
    
    print(f"✅ {name} - {price} грн")

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
    print(f"ID: {row[0]}, Price: {row[2]} грн")

conn.close()
print("\n✅ Готово! Скопируйте shop.db в services/shop.db")
