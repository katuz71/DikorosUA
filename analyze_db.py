import sqlite3
import re
from collections import defaultdict

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# 1. Получаем все товары
cursor.execute('SELECT id, name, price, category FROM products ORDER BY id')
products = cursor.fetchall()

print(f"=" * 80)
print(f"АНАЛИЗ БАЗЫ ДАННЫХ: {len(products)} товаров")
print(f"=" * 80)

# 2. Анализируем паттерны в названиях
patterns = {
    'weight': re.compile(r'(\d+)\s*(г|гр|грам|кг|мг|мл|шт|капсул)', re.IGNORECASE),
    'sort': re.compile(r'(\d+\s*сорт|сорт\s*\w+|вищий\s*гатунок|преміум|еліт)', re.IGNORECASE),
    'form': re.compile(r'(порошок|цілі|ламані|мелен[іиа]|капсул[иа]?|зерномицелій|шматочки)', re.IGNORECASE),
}

# 3. Группируем по базовому имени
def extract_base_name(name):
    """Извлекает базовое имя товара (без вариантов)"""
    base = name
    # Удаляем вес
    base = patterns['weight'].sub('', base)
    # Удаляем сорт
    base = patterns['sort'].sub('', base)
    # Удаляем форму
    base = patterns['form'].sub('', base)
    # Чистим
    base = re.sub(r'\s*[-,]\s*$', '', base)  # Удаляем висячие дефисы/запятые
    base = re.sub(r'\(\s*\)', '', base)  # Удаляем пустые скобки
    base = re.sub(r'\s+', ' ', base).strip()
    return base

groups = defaultdict(list)
for prod_id, name, price, category in products:
    base = extract_base_name(name)
    
    # Извлекаем атрибуты
    weight_match = patterns['weight'].search(name)
    sort_match = patterns['sort'].search(name)
    form_match = patterns['form'].search(name)
    
    groups[base].append({
        'id': prod_id,
        'name': name,
        'price': price,
        'category': category,
        'weight': weight_match.group(0) if weight_match else None,
        'sort': sort_match.group(0) if sort_match else None,
        'form': form_match.group(0) if form_match else None,
    })

print(f"\n📦 ГРУППИРОВКА: {len(groups)} уникальных товаров (из {len(products)} вариантов)")

# 4. Выводим группы с несколькими вариантами
print(f"\n" + "=" * 80)
print("ТОВАРЫ С ВАРИАНТАМИ (больше 1 варианта):")
print("=" * 80)

multi_variant_groups = [(base, variants) for base, variants in groups.items() if len(variants) > 1]
multi_variant_groups.sort(key=lambda x: -len(x[1]))  # Сортируем по кол-ву вариантов

for base, variants in multi_variant_groups[:20]:  # Топ 20
    print(f"\n📦 {base[:70]}...")
    print(f"   Вариантов: {len(variants)}")
    
    # Группируем по сортам
    by_sort = defaultdict(list)
    for v in variants:
        sort_key = v['sort'] or 'Без сорта'
        by_sort[sort_key].append(v)
    
    for sort_name, sort_variants in sorted(by_sort.items()):
        print(f"   [{sort_name}]:")
        for v in sorted(sort_variants, key=lambda x: x['price']):
            print(f"      ID {v['id']:3d}: {v['weight'] or 'N/A':12s} | {v['form'] or 'N/A':12s} | {v['price']:6.0f} грн")

# 5. Специально проверяем мухомор червоний
print(f"\n" + "=" * 80)
print("🍄 МУХОМОР ЧЕРВОНИЙ - ДЕТАЛЬНЫЙ АНАЛИЗ:")
print("=" * 80)

mushroom_variants = []
for prod_id, name, price, category in products:
    if 'мухомору червоного' in name.lower():
        weight_match = patterns['weight'].search(name)
        sort_match = patterns['sort'].search(name)
        form_match = patterns['form'].search(name)
        
        mushroom_variants.append({
            'id': prod_id,
            'name': name,
            'price': price,
            'weight': weight_match.group(0) if weight_match else None,
            'sort': sort_match.group(0) if sort_match else None,
            'form': form_match.group(0) if form_match else None,
        })

print(f"Найдено {len(mushroom_variants)} вариантов мухомора:\n")

# Группируем по сортам
by_sort = defaultdict(list)
for v in mushroom_variants:
    sort_key = v['sort'] or 'Без сорта'
    by_sort[sort_key].append(v)

for sort_name in ['1 сорт', '1сорт', '2 сорт', '2сорт', 'сорт Еліт', 'Еліт', 'Без сорта']:
    if sort_name in by_sort:
        print(f"\n[{sort_name}]:")
        for v in sorted(by_sort[sort_name], key=lambda x: (x['weight'] or '', x['price'])):
            print(f"  ID {v['id']:3d}: {v['name'][:60]:<60} | {v['price']:6.0f} грн")

# Проверяем все сорты
print(f"\nВсе найденные сорта: {list(by_sort.keys())}")

conn.close()
