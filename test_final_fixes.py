import sqlite3
import re

# Финальные улучшенные regex с нормализацией
regexes = {
    'year': r'\b(202[0-9])\b',
    'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
    'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Зерноміцелій)',
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
    
    # Sort - с нормализацией
    s_match = re.search(regexes['sort'], name, re.IGNORECASE)
    if s_match:
        sort_value = s_match.group(0)
        # Нормализуем: "2сорт" → "2 сорт"
        sort_value = re.sub(r'(\d+)сорт', r'\1 сорт', sort_value, flags=re.IGNORECASE)
        attributes['sort'] = sort_value
        base_name = base_name.replace(s_match.group(0), '')
    
    # Form
    f_match = re.search(regexes['form'], name, re.IGNORECASE)
    if f_match:
        attributes['form'] = f_match.group(0)
        base_name = base_name.replace(f_match.group(0), '')
    elif 'сушен' in name.lower():
        # По умолчанию для сушеных товаров без указания формы
        attributes['form'] = 'Без обробки'
    
    # Weight - с нормализацией
    w_match = re.search(regexes['weight'], name, re.IGNORECASE)
    if w_match:
        weight_value = w_match.group(0)
        # Нормализуем: "50грам" → "50 грам"
        weight_value = re.sub(r'(\d+)\s*(грам|г|кг)', r'\1 \2', weight_value, flags=re.IGNORECASE)
        attributes['weight'] = weight_value
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
print("✅ ФИНАЛЬНЫЙ ТЕСТ С ИСПРАВЛЕНИЯМИ")
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
print("✅ ПРОВЕРКА ИСПРАВЛЕНИЙ:")
print("=" * 120)

checks = []

# Проверка формы
has_bez_obrobky = 'Без обробки' in all_variants['form']
has_poroshok = any('порошок' in f.lower() for f in all_variants['form'])
checks.append(('✅' if has_bez_obrobky else '❌') + f" Форма 'Без обробки' найдена")
checks.append(('✅' if has_poroshok else '❌') + f" Форма 'Порошок' найдена")

# Проверка дубликатов сорта
sort_list = list(all_variants['sort'])
has_2sort_duplicate = '2сорт' in sort_list and '2 сорт' in sort_list
checks.append(('❌' if has_2sort_duplicate else '✅') + f" Нет дубликата '2сорт' и '2 сорт'")

# Проверка нормализации веса
weight_list = list(all_variants['weight'])
has_weight_duplicate = any(w.replace(' ', '') == w2.replace(' ', '') and w != w2 for w in weight_list for w2 in weight_list)
checks.append(('❌' if has_weight_duplicate else '✅') + f" Нет дубликатов веса (50грам/50 грам)")

# Проверка сортов
checks.append(('✅' if 'Еліт' in all_variants['sort'] else '❌') + " Сорт Еліт")
checks.append(('✅' if '1 сорт' in all_variants['sort'] else '❌') + " 1 сорт")
checks.append(('✅' if '2 сорт' in all_variants['sort'] else '❌') + " 2 сорт")

print("\nРЕЗУЛЬТАТЫ:")
for check in checks:
    print(f"   {check}")

if all('✅' in c for c in checks):
    print("\n🎉 ВСЕ ИСПРАВЛЕНИЯ РАБОТАЮТ КОРРЕКТНО!")
else:
    print("\n⚠️  Некоторые проблемы остались")

# Показываем примеры вариантов с ценами
print("\n" + "=" * 120)
print("💰 ПРИМЕРЫ ВАРИАНТОВ С ЦЕНАМИ:")
print("=" * 120)

for base_name, data in list(groups.items())[:1]:
    print(f"\n📦 {base_name}\n")
    for v in data['variants'][:10]:
        attrs_str = ' | '.join([f"{k}: {val}" for k, val in v['attrs'].items()])
        print(f"   [{v['id']:3d}] {attrs_str:60s} → {v['price']:5d} грн")

conn.close()
