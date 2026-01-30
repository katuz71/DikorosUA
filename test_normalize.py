import sqlite3
import re

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Симулируем НОВУЮ normalizeProduct из database.ts
def normalize_product(name):
    regexes = {
        'year': re.compile(r'\b(202[0-9])\b'),
        # Захватываем: "1 сорт", "1сорт", "2 сорт", "2сорт", "сорт Еліт", "Еліт", "Вищий сорт"
        'sort': re.compile(r'(\d\s*сорт|сорт\s*еліт|еліт|вищий\s*сорт|вищий\s*гатунок|преміум)', re.IGNORECASE),
        # Формы обработки
        'form': re.compile(r'(порошок|мелен[іийа]|ціл[іа]|капсул[иа]?|зерноміцелій|ламан[іий]|шматочки)', re.IGNORECASE),
        # Вес с разными вариантами написания
        'weight': re.compile(r'[-–]?\s*(\d+)\s*(грам|грамм|гр|г)\b', re.IGNORECASE)
    }
    
    attributes = {}
    base_name = name
    
    # 1. Извлекаем год
    y_match = regexes['year'].search(name)
    if y_match:
        attributes['year'] = y_match.group(1)
        base_name = regexes['year'].sub('', base_name)
    
    # 2. Извлекаем сорт и НОРМАЛИЗУЕМ
    s_match = regexes['sort'].search(name)
    if s_match:
        sort_value = s_match.group(0).strip()
        # Нормализуем: "1сорт" -> "1 сорт", "сорт Еліт" -> "Еліт"
        sort_value = re.sub(r'(\d)\s*сорт', r'\1 сорт', sort_value, flags=re.IGNORECASE)
        sort_value = re.sub(r'сорт\s*', '', sort_value, flags=re.IGNORECASE)
        # Capitalize first letter
        sort_value = sort_value[0].upper() + sort_value[1:].lower() if sort_value else ''
        # Специальные случаи
        if 'еліт' in sort_value.lower():
            sort_value = 'Еліт'
        if re.match(r'^\d', sort_value):
            sort_value = re.sub(r'(\d)\s*', r'\1 ', sort_value) + 'сорт'
        attributes['sort'] = sort_value.strip()
        base_name = regexes['sort'].sub('', base_name)
    
    # 3. Извлекаем форму
    f_match = regexes['form'].search(name)
    if f_match:
        form_value = f_match.group(0).lower()
        # Нормализуем формы
        if 'порошок' in form_value or 'мелен' in form_value:
            attributes['form'] = 'Порошок'
        elif 'капсул' in form_value:
            attributes['form'] = 'Капсули'
        elif 'ціл' in form_value:
            attributes['form'] = 'Цілі'
        elif 'ламан' in form_value:
            attributes['form'] = 'Ламані'
        else:
            attributes['form'] = f_match.group(0)
        base_name = regexes['form'].sub('', base_name)
    elif 'сушен' in name.lower() and 'порошок' not in name.lower():
        # Если сушений но не порошок - значит цілі
        attributes['form'] = 'Цілі'
    
    # 4. Извлекаем вес
    w_match = regexes['weight'].search(name)
    if w_match:
        weight_num = w_match.group(1)
        attributes['weight'] = f'{weight_num} грам'
        base_name = regexes['weight'].sub('', base_name)
    
    # 5. Очищаем baseName
    base_name = re.sub(r'сорт\s*', '', base_name, flags=re.IGNORECASE)
    base_name = re.sub(r'[-–]\s*$', '', base_name)
    base_name = re.sub(r',\s*,', ',', base_name)
    base_name = re.sub(r'\s*,\s*$', '', base_name)
    base_name = re.sub(r'^\s*,\s*', '', base_name)
    base_name = re.sub(r'\(\s*\)', '', base_name)
    base_name = re.sub(r'\s+', ' ', base_name).strip()
    
    return {'base_name': base_name, 'attrs': attributes}

# Анализируем мухомор червоний
print("=" * 100)
print("🍄 МУХОМОР ЧЕРВОНИЙ - КАК ПАРСИТСЯ normalizeProduct:")
print("=" * 100)

cursor.execute("""
    SELECT id, name, price FROM products 
    WHERE name LIKE '%мухомору червоного%' 
    AND name LIKE '%Шляпки%'
    ORDER BY id
""")
products = cursor.fetchall()

# Группируем результаты
from collections import defaultdict
groups = defaultdict(list)

for prod_id, name, price in products:
    result = normalize_product(name)
    attrs = result['attrs']
    base = result['base_name']
    
    # Формируем ключ группы
    groups[base].append({
        'id': prod_id,
        'name': name,
        'price': price,
        'attrs': attrs
    })

print(f"\nГруппировка: {len(groups)} группы\n")

for base_name, variants in groups.items():
    print(f"\n📦 ГРУППА: \"{base_name[:60]}...\"")
    print(f"   Вариантов: {len(variants)}")
    print("-" * 90)
    
    # Собираем уникальные опции
    sorts = set()
    forms = set()
    weights = set()
    
    for v in variants:
        if 'sort' in v['attrs']: sorts.add(v['attrs']['sort'])
        if 'form' in v['attrs']: forms.add(v['attrs']['form'])
        if 'weight' in v['attrs']: weights.add(v['attrs']['weight'])
    
    print(f"   Сорты: {sorted(sorts) if sorts else 'НЕТ'}")
    print(f"   Формы: {sorted(forms) if forms else 'НЕТ'}")
    sorted_weights = sorted(weights, key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0) if weights else []
    print(f"   Веса:  {sorted_weights if sorted_weights else 'НЕТ'}")
    print("-" * 90)
    
    for v in sorted(variants, key=lambda x: x['price']):
        attrs_str = ', '.join([f"{k}={v}" for k, v in v['attrs'].items()])
        print(f"   ID {v['id']:3d} | {v['price']:5.0f} грн | {attrs_str}")

# Проверяем проблему: какие варианты НЕ имеют sort но имеют weight
print("\n" + "=" * 100)
print("⚠️ ПРОБЛЕМНЫЕ ВАРИАНТЫ (есть вес, но нет сорта):")
print("=" * 100)

for base_name, variants in groups.items():
    for v in variants:
        if 'weight' in v['attrs'] and 'sort' not in v['attrs']:
            print(f"ID {v['id']:3d}: {v['name'][:70]} | {v['price']} грн")
            print(f"         attrs: {v['attrs']}")

# Тестируем поиск варианта
print("\n" + "=" * 100)
print("🧪 ТЕСТ ПОИСКА ВАРИАНТА:")
print("=" * 100)

def find_variant(variants, selections):
    """Симуляция findBestVariant"""
    for v in variants:
        matches = True
        for key, value in selections.items():
            variant_val = v['attrs'].get(key, '')
            selected_val = value
            
            # Нормализуем для сравнения
            norm_variant = str(variant_val).lower().strip()
            norm_selected = str(selected_val).lower().strip()
            
            if norm_variant != norm_selected:
                matches = False
                break
        
        if matches:
            return v
    return None

# Берем первую группу (шляпки мухомора)
main_group = list(groups.values())[0] if groups else []

test_cases = [
    {'sort': '1 сорт', 'form': 'Цілі', 'weight': '50 грам'},
    {'sort': '1 сорт', 'form': 'Цілі', 'weight': '100 грам'},
    {'sort': '1 сорт', 'form': 'Цілі', 'weight': '200 грам'},
    {'sort': '1 сорт', 'form': 'Порошок', 'weight': '50 грам'},
    {'sort': '2 сорт', 'form': 'Цілі', 'weight': '50 грам'},
    {'sort': '2 сорт', 'form': 'Цілі', 'weight': '100 грам'},
    {'sort': '2 сорт', 'form': 'Порошок', 'weight': '200 грам'},
    {'sort': 'Еліт', 'form': 'Цілі', 'weight': '50 грам'},
    {'sort': 'Еліт', 'form': 'Порошок', 'weight': '100 грам'},
]

for selections in test_cases:
    result = find_variant(main_group, selections)
    if result:
        print(f"✅ {selections} -> ID {result['id']}, {result['price']} грн")
    else:
        print(f"❌ {selections} -> НЕ НАЙДЕН")
        # Показываем что есть с этим сортом
        sort_val = selections.get('sort', '')
        matching = [v for v in main_group if v['attrs'].get('sort', '').lower() == sort_val.lower()]
        if matching:
            print(f"   Доступные варианты с сортом '{sort_val}':")
            for m in matching:
                print(f"      ID {m['id']}: attrs={m['attrs']}, price={m['price']}")

conn.close()
