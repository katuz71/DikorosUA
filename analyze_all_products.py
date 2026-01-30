import sqlite3
import re
from collections import defaultdict

# Подключаемся к БД
conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Получаем все товары
cursor.execute("SELECT id, name, category FROM products ORDER BY category, name")
products = cursor.fetchall()

print(f"Всего товаров: {len(products)}\n")

# Regex из database.ts
weight_regex = re.compile(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', re.IGNORECASE)
sort_regex = re.compile(r'(\d\s*сорт|сорт\s*еліт|еліт|вищий\s*сорт|вищий\s*гатунок|преміум)', re.IGNORECASE)
form_regex = re.compile(r'(порошок|мелен[іийа]|ціл[іа]|капсул[иа]?|зерноміцелій|ламан[іий]|шматочки)', re.IGNORECASE)
year_regex = re.compile(r'\b(202[0-9])\b')

# Категории проблем
issues = defaultdict(list)
stats = {
    'total': len(products),
    'with_weight': 0,
    'with_sort': 0,
    'with_form': 0,
    'with_year': 0,
    'no_variants': 0
}

# Специальные паттерны которые нужно добавить
special_patterns = {
    'volume': [],  # мл, літр
    'capsules': [],  # капсул
    'pieces': [],  # штук
    'percentage': [],  # %
}

for product_id, name, category in products:
    has_weight = bool(weight_regex.search(name))
    has_sort = bool(sort_regex.search(name))
    has_form = bool(form_regex.search(name))
    has_year = bool(year_regex.search(name))
    
    if has_weight:
        stats['with_weight'] += 1
    if has_sort:
        stats['with_sort'] += 1
    if has_form:
        stats['with_form'] += 1
    if has_year:
        stats['with_year'] += 1
    
    # Проверяем специальные паттерны
    if re.search(r'\d+\s*мл', name, re.IGNORECASE):
        special_patterns['volume'].append((product_id, name))
    elif re.search(r'\d+\s*літр', name, re.IGNORECASE):
        special_patterns['volume'].append((product_id, name))
    elif re.search(r'\d+\s*капсул', name, re.IGNORECASE):
        special_patterns['capsules'].append((product_id, name))
    elif re.search(r'\d+%', name):
        special_patterns['percentage'].append((product_id, name))
    
    # Товары без вариантов
    if not (has_weight or has_sort or has_form or has_year):
        stats['no_variants'] += 1
        issues['no_variants'].append((product_id, name, category))

print("=" * 80)
print("СТАТИСТИКА:")
print("=" * 80)
print(f"Всего товаров: {stats['total']}")
print(f"С весом (грам): {stats['with_weight']} ({stats['with_weight']/stats['total']*100:.1f}%)")
print(f"С сортом: {stats['with_sort']} ({stats['with_sort']/stats['total']*100:.1f}%)")
print(f"С формой: {stats['with_form']} ({stats['with_form']/stats['total']*100:.1f}%)")
print(f"С годом: {stats['with_year']} ({stats['with_year']/stats['total']*100:.1f}%)")
print(f"Без вариантов: {stats['no_variants']} ({stats['no_variants']/stats['total']*100:.1f}%)")

print("\n" + "=" * 80)
print("СПЕЦИАЛЬНЫЕ ПАТТЕРНЫ (не грамы):")
print("=" * 80)

print(f"\n📦 Объем (мл/літр): {len(special_patterns['volume'])} товаров")
if special_patterns['volume']:
    for pid, name in special_patterns['volume'][:5]:
        print(f"  - [{pid}] {name}")
    if len(special_patterns['volume']) > 5:
        print(f"  ... и еще {len(special_patterns['volume']) - 5}")

print(f"\n💊 Капсулы: {len(special_patterns['capsules'])} товаров")
if special_patterns['capsules']:
    for pid, name in special_patterns['capsules'][:5]:
        print(f"  - [{pid}] {name}")
    if len(special_patterns['capsules']) > 5:
        print(f"  ... и еще {len(special_patterns['capsules']) - 5}")

print(f"\n📊 Проценты (%): {len(special_patterns['percentage'])} товаров")
if special_patterns['percentage']:
    for pid, name in special_patterns['percentage'][:5]:
        print(f"  - [{pid}] {name}")
    if len(special_patterns['percentage']) > 5:
        print(f"  ... и еще {len(special_patterns['percentage']) - 5}")

print("\n" + "=" * 80)
print("ТОВАРЫ БЕЗ ВАРИАНТОВ (первые 20):")
print("=" * 80)
for pid, name, cat in issues['no_variants'][:20]:
    print(f"[{pid}] {cat}: {name}")

if len(issues['no_variants']) > 20:
    print(f"\n... и еще {len(issues['no_variants']) - 20} товаров")

conn.close()
