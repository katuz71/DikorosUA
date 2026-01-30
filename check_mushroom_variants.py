import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

print("=" * 120)
print("🍄 АНАЛИЗ ВАРИАНТОВ МУХОМОРА ЧЕРВОНОГО")
print("=" * 120)

# Получаем все товары с мухомором червоным
cursor.execute('''
    SELECT id, name, price, category 
    FROM products 
    WHERE name LIKE '%мухомор%червон%' OR name LIKE '%Amanita muscaria%'
    ORDER BY name
''')

products = cursor.fetchall()

print(f"\nНайдено товаров: {len(products)}\n")

# Группируем по атрибутам
variants_data = {
    'year': set(),
    'sort': set(),
    'form': set(),
    'weight': set()
}

print("ПОЛНЫЙ СПИСОК ТОВАРОВ:")
print("-" * 120)

for pid, name, price, category in products:
    print(f"[{pid:3d}] {name} → {price} грн")
    
    # Анализируем название
    name_lower = name.lower()
    
    # Год
    if '2025' in name: variants_data['year'].add('2025')
    if '2024' in name: variants_data['year'].add('2024')
    if '2023' in name: variants_data['year'].add('2023')
    
    # Сорт
    if 'еліт' in name_lower or 'элит' in name_lower: variants_data['sort'].add('Еліт')
    if '1 сорт' in name_lower or '1сорт' in name_lower: variants_data['sort'].add('1 сорт')
    if '2 сорт' in name_lower or '2сорт' in name_lower: variants_data['sort'].add('2 сорт')
    if '3 сорт' in name_lower or '3сорт' in name_lower: variants_data['sort'].add('3 сорт')
    
    # Форма
    if 'порошок' in name_lower: variants_data['form'].add('Порошок')
    if 'мелен' in name_lower: variants_data['form'].add('Мелений')
    if 'без обробки' in name_lower: variants_data['form'].add('Без обробки')
    if 'шляпк' in name_lower: variants_data['form'].add('Шляпки')
    if 'цілі' in name_lower or 'целые' in name_lower: variants_data['form'].add('Цілі')
    
    # Вес
    import re
    weight_match = re.search(r'(\d+)\s*(грам|г\b|кг|мг)', name_lower)
    if weight_match:
        value = weight_match.group(1)
        unit = weight_match.group(2)
        if unit == 'г' or unit.startswith('грам'):
            variants_data['weight'].add(f'{value} грам')
        elif unit == 'кг':
            variants_data['weight'].add(f'{value} кг')

print("\n" + "=" * 120)
print("📊 НАЙДЕННЫЕ ВАРИАНТЫ:")
print("=" * 120)

print(f"\n🗓️  Врожай ({len(variants_data['year'])} варіантів):")
for v in sorted(variants_data['year'], reverse=True):
    print(f"   - {v}")

print(f"\n🏆 Сорт ({len(variants_data['sort'])} варіантів):")
for v in sorted(variants_data['sort']):
    print(f"   - {v}")

print(f"\n📦 Фасування ({len(variants_data['weight'])} варіантів):")
for v in sorted(variants_data['weight'], key=lambda x: int(x.split()[0]) if x.split()[0].isdigit() else 0):
    print(f"   - {v}")

print(f"\n🔄 Форма продукту ({len(variants_data['form'])} варіантів):")
for v in sorted(variants_data['form']):
    print(f"   - {v}")

print("\n" + "=" * 120)
print("💡 РЕКОМЕНДАЦИИ ДЛЯ УЛУЧШЕНИЯ РЕГУЛЯРНЫХ ВЫРАЖЕНИЙ:")
print("=" * 120)

print("""
1. ФАСУВАННЯ - нужно улучшить regex:
   - Текущий: (\d+\s*(?:г|кг|мг|мл|шт|капсул))
   - Проблема: не ловит "грам", "грамм"
   - Решение: (\d+\s*(?:грам|г\b|кг|мг|мл|шт|капсул))

2. ФОРМА - добавить "Без обробки":
   - Текущий: (Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Шляпки|Зерноміцелій)
   - Добавить: Без\s*обробки

3. СОРТ - работает корректно

4. ГОД - работает корректно
""")

conn.close()
