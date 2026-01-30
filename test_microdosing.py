import sqlite3
import re

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Получаем все микродозинг товары
cursor.execute("SELECT id, name, price FROM products WHERE name LIKE '%мікродозінг%' OR name LIKE '%капсул%' ORDER BY name LIMIT 20")
products = cursor.fetchall()

print(f"Найдено микродозинг товаров: {len(products)}\n")

# Текущий regex из database.ts
capsules_regex = re.compile(r'(\d+)\s*капсул', re.IGNORECASE)
weight_regex = re.compile(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', re.IGNORECASE)
percentage_regex = re.compile(r'(\d+(?:[.,]\d+)?)%')

print("=" * 80)
print("АНАЛИЗ НАЗВАНИЙ:")
print("=" * 80)

for pid, name, price in products:
    print(f"\n[{pid}] {name}")
    print(f"  Цена: {price} UAH")
    
    # Проверяем что захватывается
    caps_match = capsules_regex.search(name)
    weight_match = weight_regex.search(name)
    
    if caps_match:
        print(f"  ✅ Капсулы: {caps_match.group(1)} капсул")
    else:
        print(f"  ❌ Капсулы не найдены")
    
    if weight_match:
        print(f"  ⚖️ Вес в названии: {weight_match.group(0)}")
    
    # Проверяем паттерн "по X грама"
    per_gram_match = re.search(r'по\s+([\d,]+)\s*грам[аи]?', name, re.IGNORECASE)
    if per_gram_match:
        print(f"  📦 По X грама: {per_gram_match.group(1)}")

print("\n" + "=" * 80)
print("ПРОБЛЕМЫ:")
print("=" * 80)
print("1. Regex для капсул захватывает только количество, без 'по X грама'")
print("2. Нужно извлекать полную информацию: '60 капсул по 0,5 грама'")
print("3. BaseName должен быть одинаковым для 60 и 120 капсул одного продукта")

conn.close()
