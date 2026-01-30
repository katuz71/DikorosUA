import xml.etree.ElementTree as ET
import sqlite3
import re
from collections import defaultdict

# Парсимо XML
tree = ET.parse('services/products_feed.xml')
root = tree.getroot()

# Збираємо всі товари
products = []
for offer in root.findall('.//offer'):
    product = {
        'id': offer.get('id'),
        'group_id': offer.get('group_id'),
        'name_ru': offer.find('name').text if offer.find('name') is not None else '',
        'name_ua': offer.find('name_ua').text if offer.find('name_ua') is not None else '',
        'price': float(offer.find('price').text) if offer.find('price') is not None else 0,
        'old_price': float(offer.find('oldprice').text) if offer.find('oldprice') is not None else None,
        'category_id': offer.find('categoryId').text if offer.find('categoryId') is not None else '',
        'image': offer.find('picture').text if offer.find('picture') is not None else '',
        'vendor_code': offer.find('vendorCode').text if offer.find('vendorCode') is not None else ''
    }
    products.append(product)

print(f"📦 Всього товарів в XML: {len(products)}")

# Аналізуємо патерни в назвах
patterns = {
    'weight': defaultdict(list),
    'capsules': defaultdict(list),
    'volume': defaultdict(list),
    'sort': defaultdict(list),
    'form': defaultdict(list),
    'percentage': defaultdict(list)
}

# Regex для різних типів варіантів
regexes = {
    'weight': re.compile(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', re.IGNORECASE),
    'capsules_with_dose': re.compile(r'(\d+)\s*капсул\s+по\s+([\d,]+)\s*г(?:рам[аи]?|р)?', re.IGNORECASE),
    'capsules': re.compile(r'(\d+)\s*капсул', re.IGNORECASE),
    'volume': re.compile(r'[-–]?\s*(\d+(?:[.,]\d+)?)\s*(мл|літр[аи]?)', re.IGNORECASE),
    'sort': re.compile(r'(\d\s*сорт|сорт\s*еліт|еліт|вищий\s*сорт|преміум)', re.IGNORECASE),
    'form': re.compile(r'(порошок|мелен[іийа]|ціл[іа]|капсул[иа]?|зерноміцелій|ламан[іий]|шматочки|сушен[іи]|різан[іи])', re.IGNORECASE),
    'percentage': re.compile(r'(\d+(?:[.,]\d+)?)%')
}

print("\n" + "="*80)
print("АНАЛІЗ ПАТЕРНІВ В НАЗВАХ:")
print("="*80)

for product in products:
    name = product['name_ua'] or product['name_ru']
    
    # Капсули з дозировкою (перевіряємо першими!)
    caps_dose = regexes['capsules_with_dose'].search(name)
    if caps_dose:
        patterns['capsules'][f"{caps_dose.group(1)} капсул по {caps_dose.group(2)}гр"].append(product)
        continue
    
    # Капсули без дозировки
    caps = regexes['capsules'].search(name)
    if caps:
        patterns['capsules'][f"{caps.group(1)} капсул"].append(product)
        continue
    
    # Об'єм
    vol = regexes['volume'].search(name)
    if vol:
        patterns['volume'][f"{vol.group(1)} {vol.group(2)}"].append(product)
    
    # Вес (тільки якщо не після "по")
    weight = regexes['weight'].search(name)
    if weight:
        # Перевіряємо що це не частина "по X грама"
        before_weight = name[:weight.start()]
        if not re.search(r'по\s+[\d,]*$', before_weight, re.IGNORECASE):
            patterns['weight'][f"{weight.group(1)} грам"].append(product)
    
    # Сорт
    sort_match = regexes['sort'].search(name)
    if sort_match:
        patterns['sort'][sort_match.group(0)].append(product)
    
    # Форма
    form = regexes['form'].search(name)
    if form:
        patterns['form'][form.group(0)].append(product)
    
    # Процент
    perc = regexes['percentage'].search(name)
    if perc:
        patterns['percentage'][f"{perc.group(1)}%"].append(product)

# Виводимо статистику
for pattern_type, items in patterns.items():
    if items:
        print(f"\n📊 {pattern_type.upper()}: {len(items)} унікальних значень")
        for value, prods in sorted(items.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
            print(f"  - {value}: {len(prods)} товарів")

# Групуємо товари за group_id
groups = defaultdict(list)
for product in products:
    if product['group_id']:
        groups[product['group_id']].append(product)

print(f"\n📦 Груп товарів (group_id): {len(groups)}")
print(f"📦 Товарів без групи: {len([p for p in products if not p['group_id']])}")

# Аналізуємо групи з варіантами
multi_variant_groups = {gid: prods for gid, prods in groups.items() if len(prods) > 1}
print(f"📦 Груп з варіантами (>1 товар): {len(multi_variant_groups)}")

print("\n" + "="*80)
print("ПРИКЛАДИ ГРУП З ВАРІАНТАМИ:")
print("="*80)

for gid, prods in list(multi_variant_groups.items())[:10]:
    print(f"\n🔸 Group {gid}: {len(prods)} варіантів")
    for p in prods[:5]:
        name = p['name_ua'] or p['name_ru']
        print(f"  [{p['id']}] {name[:100]}... - {p['price']} UAH")

# Створюємо нову БД
print("\n" + "="*80)
print("СТВОРЕННЯ НОВОЇ БД:")
print("="*80)

conn = sqlite3.connect('services/dikoros_new.db')
cursor = conn.cursor()

# Створюємо таблицю products
cursor.execute('''
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    group_id INTEGER,
    name TEXT NOT NULL,
    name_ru TEXT,
    price REAL NOT NULL,
    old_price REAL,
    category TEXT,
    image TEXT,
    picture TEXT,
    image_url TEXT,
    vendor_code TEXT
)
''')

# Створюємо таблицю categories
cursor.execute('''
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
)
''')

# Мапінг категорій
category_map = {
    '1084': 'Мікродозінг',
    '1087': 'Сушені гриби',
    '1114': 'CBD',
    '1093': 'Мазі',
    '1091': 'Настоянки',
    '1085': 'Трави та ягоди',
    '1094': 'Ваги',
    '1098': 'Консервація та мед'
}

# Вставляємо категорії
for cat_id, cat_name in category_map.items():
    cursor.execute('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)', (int(cat_id), cat_name))

# Вставляємо товари
inserted = 0
for product in products:
    name = product['name_ua'] or product['name_ru']
    category = category_map.get(product['category_id'], 'Інше')
    
    cursor.execute('''
        INSERT INTO products (id, group_id, name, name_ru, price, old_price, category, image, picture, image_url, vendor_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        int(product['id']),
        int(product['group_id']) if product['group_id'] else None,
        name,
        product['name_ru'],
        product['price'],
        product['old_price'],
        category,
        product['image'],
        product['image'],
        product['image'],
        product['vendor_code']
    ))
    inserted += 1

conn.commit()
print(f"✅ Вставлено {inserted} товарів")
print(f"✅ Вставлено {len(category_map)} категорій")

# Перевіряємо результат
cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f"✅ Всього в БД: {total} товарів")

cursor.execute('SELECT category, COUNT(*) FROM products GROUP BY category')
for cat, count in cursor.fetchall():
    print(f"  - {cat}: {count} товарів")

conn.close()

print("\n" + "="*80)
print("✅ НОВА БД СТВОРЕНА: services/dikoros_new.db")
print("="*80)
