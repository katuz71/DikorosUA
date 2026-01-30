import sqlite3
import re

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ТЕСТУВАННЯ НОВОЇ БД")
print("="*80)

# 1. Загальна статистика
cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f"\n✅ Всього товарів: {total}")

cursor.execute('SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY COUNT(*) DESC')
print("\n📊 Товарів по категоріях:")
for cat, count in cursor.fetchall():
    print(f"  - {cat}: {count}")

# 2. Перевірка group_id
cursor.execute('SELECT COUNT(DISTINCT group_id) FROM products WHERE group_id IS NOT NULL')
groups = cursor.fetchone()[0]
print(f"\n🔗 Унікальних груп (group_id): {groups}")

cursor.execute('''
    SELECT group_id, COUNT(*) as cnt
    FROM products
    WHERE group_id IS NOT NULL
    GROUP BY group_id
    HAVING cnt > 1
''')
multi_groups = cursor.fetchall()
print(f"🔗 Груп з варіантами (>1 товар): {len(multi_groups)}")

# 3. Тестування мікродозингу
print("\n" + "="*80)
print("ТЕСТ: МІКРОДОЗИНГ (капсули)")
print("="*80)

cursor.execute('''
    SELECT id, name, price, group_id
    FROM products
    WHERE category = 'Мікродозінг' AND name LIKE '%капсул%'
    ORDER BY group_id, name
    LIMIT 10
''')

for pid, name, price, gid in cursor.fetchall():
    # Парсимо капсули
    caps_match = re.search(r'(\d+)\s*капсул\s+по\s+([\d,]+)\s*г(?:рам[аи]?|р)?', name, re.IGNORECASE)
    if caps_match:
        print(f"✅ [{gid}] {name[:60]}...")
        print(f"   Капсули: {caps_match.group(1)}, Дозировка: {caps_match.group(2)}гр, Ціна: {price} UAH")
    else:
        print(f"⚠️ [{gid}] {name[:60]}... - НЕ РОЗПІЗНАНО")

# 4. Тестування грибів (вага)
print("\n" + "="*80)
print("ТЕСТ: СУШЕНІ ГРИБИ (вага)")
print("="*80)

cursor.execute('''
    SELECT id, name, price, group_id
    FROM products
    WHERE category = 'Сушені гриби' AND name LIKE '%грам%'
    ORDER BY group_id, price
    LIMIT 10
''')

for pid, name, price, gid in cursor.fetchall():
    # Парсимо вагу
    weight_match = re.search(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', name, re.IGNORECASE)
    if weight_match:
        # Перевіряємо що не після "по"
        before = name[:weight_match.start()]
        if not re.search(r'по\s+[\d,]*$', before, re.IGNORECASE):
            print(f"✅ [{gid}] {name[:60]}...")
            print(f"   Вага: {weight_match.group(1)} грам, Ціна: {price} UAH")
        else:
            print(f"⚠️ [{gid}] {name[:60]}... - вага після 'по'")
    else:
        print(f"⚠️ [{gid}] {name[:60]}... - НЕ РОЗПІЗНАНО")

# 5. Тестування CBD (об'єм + процент)
print("\n" + "="*80)
print("ТЕСТ: CBD МАСЛА (об'єм + концентрація)")
print("="*80)

cursor.execute('''
    SELECT id, name, price, group_id
    FROM products
    WHERE category = 'CBD' AND name LIKE '%CBD%'
    ORDER BY group_id, price
    LIMIT 10
''')

for pid, name, price, gid in cursor.fetchall():
    # Парсимо об'єм та процент
    vol_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(мл|літр[аи]?)', name, re.IGNORECASE)
    perc_match = re.search(r'(\d+(?:[.,]\d+)?)%', name)
    
    if vol_match and perc_match:
        print(f"✅ [{gid}] {name[:60]}...")
        print(f"   Об'єм: {vol_match.group(1)} {vol_match.group(2)}, Концентрація: {perc_match.group(1)}%, Ціна: {price} UAH")
    elif vol_match:
        print(f"⚠️ [{gid}] {name[:60]}... - тільки об'єм")
    elif perc_match:
        print(f"⚠️ [{gid}] {name[:60]}... - тільки процент")
    else:
        print(f"⚠️ [{gid}] {name[:60]}... - НЕ РОЗПІЗНАНО")

# 6. Тестування настоянок (об'єм)
print("\n" + "="*80)
print("ТЕСТ: НАСТОЯНКИ (об'єм)")
print("="*80)

cursor.execute('''
    SELECT id, name, price, group_id
    FROM products
    WHERE category = 'Настоянки'
    ORDER BY group_id, price
    LIMIT 10
''')

for pid, name, price, gid in cursor.fetchall():
    # Парсимо об'єм
    vol_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(мл|літр[аи]?)', name, re.IGNORECASE)
    
    if vol_match:
        print(f"✅ [{gid}] {name[:60]}...")
        print(f"   Об'єм: {vol_match.group(1)} {vol_match.group(2)}, Ціна: {price} UAH")
    else:
        print(f"⚠️ [{gid}] {name[:60]}... - НЕ РОЗПІЗНАНО")

# 7. Перевірка конкретних проблемних груп
print("\n" + "="*80)
print("ТЕСТ: КОНКРЕТНІ ГРУПИ З ВАРІАНТАМИ")
print("="*80)

# Мікродозинг Brain & Sleep
cursor.execute('''
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Brain & Sleep%'
    ORDER BY price
''')
print("\n🔸 Мікродозинг Brain & Sleep:")
for pid, name, price in cursor.fetchall():
    print(f"  [{pid}] {name[:70]}... - {price} UAH")

# Мухомор червоний шляпки
cursor.execute('''
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%сорт%'
    ORDER BY price
    LIMIT 6
''')
print("\n🔸 Шляпки мухомору червоного (1 сорт):")
for pid, name, price in cursor.fetchall():
    print(f"  [{pid}] {name[:70]}... - {price} UAH")

# CBD масла
cursor.execute('''
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Олія CBD МСТ%'
    ORDER BY price
    LIMIT 8
''')
print("\n🔸 Олія CBD МСТ:")
for pid, name, price in cursor.fetchall():
    print(f"  [{pid}] {name[:70]}... - {price} UAH")

conn.close()

print("\n" + "="*80)
print("✅ ТЕСТУВАННЯ ЗАВЕРШЕНО")
print("="*80)
