import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ВСІ ВАРІАНТИ 1 СОРТУ ШЛЯПОК МУХОМОРА")
print("="*80)

cursor.execute("""
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%1 сорт%'
    ORDER BY price
""")

products = cursor.fetchall()
print(f"\nЗнайдено: {len(products)} варіантів\n")

for pid, name, price in products:
    print(f"[{pid}] {name}")
    print(f"  Ціна: {price} UAH")
    print()

print("="*80)
print("АНАЛІЗ:")
print("="*80)
print("""
Бачимо що є тільки варіанти з 1 грамом:
- ID 681: 1 сорт, цілі, 1 грам - 10 UAH
- ID 682: 1 сорт, порошок, 1 грам - 10 UAH

НЕ МАЄ варіантів:
- 1 сорт, 50 грам
- 1 сорт, 100 грам
- 1 сорт, 200 грам

Тому коли користувач вибирає "1 сорт" + "50 грам", система не знаходить
точного співпадіння і показує мінімальну ціну для всієї групи (8 UAH для 2 сорту).

РІШЕННЯ:
1. Показувати тільки доступні комбінації (disable недоступні опції)
2. Або показувати ціну найближчого варіанту з правильним повідомленням
3. Або додати відсутні варіанти в БД
""")

conn.close()
