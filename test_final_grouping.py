import sqlite3
import re

# Финальные улучшенные regex
regexes = {
    'year': r'\b(202[0-9])\b',
    'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
    'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Зерноміцелій)',  # БЕЗ "Шляпки"
    'weight': r'(\d+\s*(?:грам|грамм|г\b|кг|мг|мл|шт|капсул))'
}

def normalize_product(name):
    attributes = {}
    base_name = name
    
    # Year
    y_match = re.search(regexes['year'], name)
    if y_match:
        attributes['year'] = y_match.group(0)
        base_name = base_name.replace(y_match.group(0), '')
    
    # Sort
    s_match = re.search(regexes['sort'], name, re.IGNORECASE)
    if s_match:
        attributes['sort'] = s_match.group(0)
        base_name = base_name.replace(s_match.group(0), '')
    
    # Form
    f_match = re.search(regexes['form'], name, re.IGNORECASE)
    if f_match:
        attributes['form'] = f_match.group(0)
        base_name = base_name.replace(f_match.group(0), '')
    
    # Weight
    w_match = re.search(regexes['weight'], name, re.IGNORECASE)
    if w_match:
        attributes['weight'] = w_match.group(0)
        base_name = base_name.replace(w_match.group(0), '')
    
    # Clean base name
    base_name = re.sub(r'\s+', ' ', base_name)
    base_name = re.sub(r'[,.-]\s*$', '', base_name)
    base_name = re.sub(r'^\s*[,.-]', '', base_name)
    base_name = re.sub(r'\(\s*\)', '', base_name)
    base_name = base_name.strip()
    
    return base_name, attributes

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

print("=" * 120)
print("✅ ФИНАЛЬНЫЙ ТЕСТ ГРУППИРОВКИ")
print("=" * 120)

# Берем все товары мухомора
cursor.execute('''
    SELECT id, name, price 
    FROM products 
    WHERE name LIKE '%Шляпки мухомору червоного%'
    ORDER BY name
''')

products = cursor.fetchall()

print(f"\nВсего товаров: {len(products)}\n")

# Группируем
groups = {}
all_variants = {
    'year': set(),
    'sort': set(),
    'form': set(),
    'weight': set()
}

for pid, name, price in products:
    base_name, attrs = normalize_product(name)
    
    if base_name not in groups:
        groups[base_name] = {
            'variants': [],
            'options': {
                'year': set(),
                'sort': set(),
                'form': set(),
                'weight': set()
            }
        }
    
    groups[base_name]['variants'].append({
        'id': pid,
        'name': name,
        'price': price,
        'attrs': attrs
    })
    
    # Собираем опции
    for key in ['year', 'sort', 'form', 'weight']:
        if key in attrs:
            groups[base_name]['options'][key].add(attrs[key])
            all_variants[key].add(attrs[key])

# Выводим результаты
print("📦 ГРУППЫ ТОВАРОВ:\n")
for base_name, data in groups.items():
    print(f"Базовое название: {base_name}")
    print(f"Вариантов: {len(data['variants'])}")
    
    if data['options']['year']:
        print(f"   🗓️  Врожай: {sorted(data['options']['year'], reverse=True)}")
    if data['options']['sort']:
        print(f"   🏆 Сорт: {sorted(data['options']['sort'])}")
    if data['options']['form']:
        print(f"   🔄 Форма: {sorted(data['options']['form'])}")
    if data['options']['weight']:
        weights = sorted(data['options']['weight'], key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0)
        print(f"   📦 Фасування: {weights}")
    print()

print("=" * 120)
print("📊 ИТОГОВАЯ СТАТИСТИКА:")
print("=" * 120)

print(f"\n🗓️  Врожай ({len(all_variants['year'])} варіантів): {sorted(all_variants['year'], reverse=True)}")
print(f"🏆 Сорт ({len(all_variants['sort'])} варіантів): {sorted(all_variants['sort'])}")
print(f"🔄 Форма ({len(all_variants['form'])} варіантів): {sorted(all_variants['form'])}")

weights = sorted(all_variants['weight'], key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0)
print(f"📦 Фасування ({len(all_variants['weight'])} варіантів): {weights}")

print("\n" + "=" * 120)
print("✅ ПРОВЕРКА СООТВЕТСТВИЯ СКРИНШОТУ:")
print("=" * 120)

expected = {
    'sort': ['1 сорт', '2 сорт', 'Еліт'],
    'form': ['Порошок'],  # На скриншоте: Мелений, Без обробки
    'weight': ['1 грам', '50 грам', '100 грам', '200 грам']
}

print("\nОжидаемые варианты:")
print(f"   Сорт: {expected['sort']}")
print(f"   Форма: Порошок, Без обробки (и другие)")
print(f"   Фасування: {expected['weight']}")

print("\nНайденные варианты:")
print(f"   Сорт: {sorted(all_variants['sort'])}")
print(f"   Форма: {sorted(all_variants['form'])}")
print(f"   Фасування: {weights}")

# Проверка
checks = []
checks.append(('✅' if 'Еліт' in all_variants['sort'] else '❌') + " Сорт Еліт")
checks.append(('✅' if '1 сорт' in all_variants['sort'] else '❌') + " 1 сорт")
checks.append(('✅' if '2 сорт' in all_variants['sort'] else '❌') + " 2 сорт")
checks.append(('✅' if 'Порошок' in all_variants['form'] else '❌') + " Форма Порошок")

weight_values = [int(re.search(r'\d+', w).group()) for w in all_variants['weight'] if re.search(r'\d+', w)]
checks.append(('✅' if 1 in weight_values else '❌') + " Фасування 1 грам")
checks.append(('✅' if 50 in weight_values else '❌') + " Фасування 50 грам")
checks.append(('✅' if 100 in weight_values else '❌') + " Фасування 100 грам")
checks.append(('✅' if 200 in weight_values else '❌') + " Фасування 200 грам")

print("\n" + "=" * 120)
print("РЕЗУЛЬТАТЫ ПРОВЕРКИ:")
print("=" * 120)
for check in checks:
    print(f"   {check}")

if all('✅' in c for c in checks):
    print("\n🎉 ВСЕ ВАРИАНТЫ РАСПОЗНАНЫ КОРРЕКТНО!")
else:
    print("\n⚠️  Некоторые варианты не найдены (возможно их нет в базе)")

conn.close()
