import sqlite3
import json

# Подключаемся к базе
conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Товар ID 4157 - Стандарт 60 капсул
# На сайте есть выбор 60/120, добавляем variants

variants = [
    {
        "size": "60 капсул|0.5г",
        "price": 332
    },
    {
        "size": "120 капсул|0.5г", 
        "price": 620  # Примерно удвоенная цена
    }
]

variants_json = json.dumps(variants, ensure_ascii=False)

# Обновляем товар
cursor.execute("""
    UPDATE products 
    SET variants = ? 
    WHERE id = 4157
""", (variants_json,))

conn.commit()

print(f"✅ Updated product 4157 (Стандарт)")
print(f"   Added variants: {variants_json}")

# Проверяем
cursor.execute("SELECT id, name, price, variants FROM products WHERE id = 4157")
result = cursor.fetchone()
print(f"\nResult:")
print(f"  ID: {result[0]}")
print(f"  Name: {result[1]}")
print(f"  Price: {result[2]}")
print(f"  Variants: {result[3]}")

conn.close()
