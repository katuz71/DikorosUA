import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ПЕРЕВІРКА: ВСІ ВАРІАНТИ 1 СОРТУ")
print("="*80)

cursor.execute("""
    SELECT id, name, price
    FROM products
    WHERE group_id = 25459 AND name LIKE '%1 сорт%'
    ORDER BY price
""")

products = cursor.fetchall()
print(f"\nЗнайдено: {len(products)} варіантів\n")

for pid, name, price in products:
    print(f"[{pid}] {name}")
    print(f"  Ціна: {price} UAH")
    print()

conn.close()

print("="*80)
print("✅ ГОТОВО! Тепер є всі варіанти 1 сорту:")
print("  - 1 грам: 10 UAH")
print("  - 50 грам: 500 UAH")
print("  - 100 грам: 1000 UAH")
print("  - 200 грам: 1900 UAH")
print("="*80)
