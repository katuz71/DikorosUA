import sqlite3
import re

# Копируем улучшенные regex из database.ts
regexes = {
    'year': r'\b(202[0-9])\b',
    'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
    'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Шляпки|Зерноміцелій)',
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
print("🧪 ТЕСТ ГРУППИРОВКИ С УЛУЧШЕННЫМИ REGEX")
print("=" * 120)

# Берем товары мухомора
cursor.execute('''
    SELECT id, name, price 
    FROM products 
    WHERE name LIKE '%Шляпки мухомору червоного%'
    ORDER BY name
    LIMIT 20
''')

products = cursor.fetchall()

print(f"\nТестируем на {len(products)} товарах:\n")

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
for base_name, data in groups.items():
    print(f"📦 {base_name}")
    print(f"   Вариантов: {len(data['variants'])}")
    
    # Показываем найденные опции
    if data['options']['year']:
        print(f"   🗓️  Врожай: {sorted(data['options']['year'], reverse=True)}")
    if data['options']['sort']:
        print(f"   🏆 Сорт: {sorted(data['options']['sort'])}")
    if data['options']['form']:
        print(f"   🔄 Форма: {sorted(data['options']['form'])}")
    if data['options']['weight']:
        weights = sorted(data['options']['weight'], key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0)
        print(f"   📦 Фасування: {weights}")
    
    # Показываем несколько вариантов
    print(f"   Примеры:")
    for v in data['variants'][:3]:
        attrs_str = ' | '.join([f"{k}: {v}" for k, v in v['attrs'].items()])
        print(f"      [{v['id']}] {attrs_str} → {v['price']} грн")
    if len(data['variants']) > 3:
        print(f"      ... и еще {len(data['variants']) - 3} вариантов")
    print()

print("=" * 120)
print("📊 ИТОГОВАЯ СТАТИСТИКА ПО ВСЕМ ВАРИАНТАМ:")
print("=" * 120)

print(f"\n🗓️  Врожай ({len(all_variants['year'])} варіантів): {sorted(all_variants['year'], reverse=True)}")
print(f"🏆 Сорт ({len(all_variants['sort'])} варіантів): {sorted(all_variants['sort'])}")
print(f"🔄 Форма ({len(all_variants['form'])} варіантів): {sorted(all_variants['form'])}")

weights = sorted(all_variants['weight'], key=lambda x: int(re.search(r'\d+', x).group()) if re.search(r'\d+', x) else 0)
print(f"📦 Фасування ({len(all_variants['weight'])} варіантів): {weights}")

print("\n" + "=" * 120)
print("✅ РЕЗУЛЬТАТ:")
print("=" * 120)

expected = {
    'year': ['2025'],
    'sort': ['1 сорт', '2 сорт', 'Еліт'],
    'form': ['Порошок', 'Без обробки'],  # Шляпки - это базовое название
    'weight': ['1 грам', '50 грам', '100 грам', '200 грам']
}

print("\nОжидаемые варианты (из скриншота):")
print(f"   Врожай: {expected['year']}")
print(f"   Сорт: {expected['sort']}")
print(f"   Форма: {expected['form']}")
print(f"   Фасування: {expected['weight']}")

print("\nНайденные варианты:")
print(f"   Врожай: {sorted(all_variants['year'], reverse=True)}")
print(f"   Сорт: {sorted(all_variants['sort'])}")
print(f"   Форма: {sorted(all_variants['form'])}")
print(f"   Фасування: {weights}")

# Проверка
issues = []
if '2025' not in all_variants['year']:
    issues.append("❌ Не найден год 2025")
if 'Еліт' not in all_variants['sort']:
    issues.append("❌ Не найден сорт Еліт")
if '1 сорт' not in all_variants['sort']:
    issues.append("❌ Не найден 1 сорт")
if '2 сорт' not in all_variants['sort']:
    issues.append("❌ Не найден 2 сорт")
if 'Порошок' not in all_variants['form']:
    issues.append("❌ Не найдена форма Порошок")

# Проверяем фасовку
weight_values = [int(re.search(r'\d+', w).group()) for w in all_variants['weight'] if re.search(r'\d+', w)]
if 1 not in weight_values:
    issues.append("❌ Не найдено фасування 1 грам")
if 50 not in weight_values:
    issues.append("❌ Не найдено фасування 50 грам")
if 100 not in weight_values:
    issues.append("❌ Не найдено фасування 100 грам")
if 200 not in weight_values:
    issues.append("❌ Не найдено фасування 200 грам")

if issues:
    print("\n⚠️  ПРОБЛЕМЫ:")
    for issue in issues:
        print(f"   {issue}")
else:
    print("\n✅ ВСЕ ВАРИАНТЫ РАСПОЗНАНЫ КОРРЕКТНО!")

conn.close()
