import sqlite3
import re
from collections import defaultdict

conn = sqlite3.connect('services/dikoros_new.db')
cursor = conn.cursor()

# Отримуємо всі групи з варіантами
cursor.execute('''
    SELECT group_id, COUNT(*) as variant_count
    FROM products
    WHERE group_id IS NOT NULL
    GROUP BY group_id
    HAVING variant_count > 1
    ORDER BY variant_count DESC
''')

groups_with_variants = cursor.fetchall()
print(f"📊 Груп з варіантами: {len(groups_with_variants)}")

# Аналізуємо кожну групу
variant_types = defaultdict(int)

for group_id, variant_count in groups_with_variants:
    cursor.execute('SELECT id, name FROM products WHERE group_id = ?', (group_id,))
    products = cursor.fetchall()
    
    # Визначаємо тип варіантів в групі
    has_weight = False
    has_capsules = False
    has_volume = False
    has_percentage = False
    has_sort = False
    has_form = False
    
    for pid, name in products:
        if re.search(r'(\d+)\s*капсул\s+по\s+([\d,]+)', name, re.IGNORECASE):
            has_capsules = True
        elif re.search(r'(\d+)\s*капсул', name, re.IGNORECASE):
            has_capsules = True
        
        if re.search(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', name, re.IGNORECASE):
            # Перевіряємо що це не після "по"
            weight_match = re.search(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', name, re.IGNORECASE)
            if weight_match:
                before = name[:weight_match.start()]
                if not re.search(r'по\s+[\d,]*$', before, re.IGNORECASE):
                    has_weight = True
        
        if re.search(r'(\d+(?:[.,]\d+)?)\s*(мл|літр)', name, re.IGNORECASE):
            has_volume = True
        
        if re.search(r'(\d+(?:[.,]\d+)?)%', name):
            has_percentage = True
        
        if re.search(r'(\d\s*сорт|сорт\s*еліт|еліт)', name, re.IGNORECASE):
            has_sort = True
        
        if re.search(r'(порошок|мелен|ціл|ламан)', name, re.IGNORECASE):
            has_form = True
    
    # Класифікуємо групу
    variant_type = []
    if has_capsules:
        variant_type.append('capsules')
    if has_weight:
        variant_type.append('weight')
    if has_volume:
        variant_type.append('volume')
    if has_percentage:
        variant_type.append('percentage')
    if has_sort:
        variant_type.append('sort')
    if has_form:
        variant_type.append('form')
    
    variant_key = '+'.join(sorted(variant_type)) if variant_type else 'unknown'
    variant_types[variant_key] += 1

print("\n" + "="*80)
print("ТИПИ ВАРІАНТІВ В ГРУПАХ:")
print("="*80)
for vtype, count in sorted(variant_types.items(), key=lambda x: x[1], reverse=True):
    print(f"  {vtype}: {count} груп")

# Детальний аналіз найпопулярніших типів
print("\n" + "="*80)
print("ДЕТАЛЬНИЙ АНАЛІЗ ГРУП:")
print("="*80)

# 1. Групи з капсулами
print("\n🔹 КАПСУЛИ:")
cursor.execute('''
    SELECT group_id, name, price
    FROM products
    WHERE group_id IN (
        SELECT group_id FROM products
        WHERE name LIKE '%капсул%'
        GROUP BY group_id
        HAVING COUNT(*) > 1
    )
    ORDER BY group_id, price
    LIMIT 20
''')
for gid, name, price in cursor.fetchall():
    print(f"  [{gid}] {name[:80]}... - {price} UAH")

# 2. Групи з вагою
print("\n🔹 ВАГА (грам):")
cursor.execute('''
    SELECT group_id, name, price
    FROM products
    WHERE group_id IN (
        SELECT group_id FROM products
        WHERE name LIKE '%грам%' AND name NOT LIKE '%капсул%'
        GROUP BY group_id
        HAVING COUNT(*) > 1
    )
    ORDER BY group_id, price
    LIMIT 20
''')
for gid, name, price in cursor.fetchall():
    print(f"  [{gid}] {name[:80]}... - {price} UAH")

# 3. Групи з об'ємом
print("\n🔹 ОБ'ЄМ (мл/літр):")
cursor.execute('''
    SELECT group_id, name, price
    FROM products
    WHERE group_id IN (
        SELECT group_id FROM products
        WHERE (name LIKE '%мл%' OR name LIKE '%літр%')
        GROUP BY group_id
        HAVING COUNT(*) > 1
    )
    ORDER BY group_id, price
    LIMIT 20
''')
for gid, name, price in cursor.fetchall():
    print(f"  [{gid}] {name[:80]}... - {price} UAH")

# 4. Групи з процентами
print("\n🔹 ПРОЦЕНТИ (%):")
cursor.execute('''
    SELECT group_id, name, price
    FROM products
    WHERE group_id IN (
        SELECT group_id FROM products
        WHERE name LIKE '%\%%' ESCAPE '\\'
        GROUP BY group_id
        HAVING COUNT(*) > 1
    )
    ORDER BY group_id, price
    LIMIT 20
''')
for gid, name, price in cursor.fetchall():
    print(f"  [{gid}] {name[:80]}... - {price} UAH")

conn.close()

print("\n" + "="*80)
print("ВИСНОВКИ:")
print("="*80)
print("""
1. Капсули: завжди мають формат "X капсул по Y грама"
   - Варіанти: 60/120 капсул
   - Дозировка: 0,35гр або 0,5гр
   
2. Вага: формат "X грам" або "X гграм"
   - Варіанти: 1, 50, 100, 200 грам
   - Іноді з сортом: "1 сорт", "2 сорт", "Еліт"
   - Іноді з формою: "порошок", "цілі", "ламані"
   
3. Об'єм: формат "X мл" або "X літр"
   - Варіанти: 10, 30, 100, 250, 300, 450, 500, 1000 мл, 1 літр
   - Часто для настоянок та CBD масел
   
4. Проценти: формат "X%"
   - Варіанти: 3,3%, 5%, 10%, 15%, 20%, 30%
   - Для CBD масел та настоянок
   
5. Комбіновані варіанти:
   - Об'єм + Процент (CBD масла)
   - Вага + Сорт + Форма (гриби)
""")
