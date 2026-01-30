import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ВАРІАНТИ ШЛЯПОК МУХОМОРА ПО СОРТАХ ТА ВАЗІ")
print("="*80)

# Отримуємо всі варіанти
cursor.execute("""
    SELECT id, name, price
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%сорт%'
    ORDER BY name
""")

products = cursor.fetchall()

# Групуємо по сорту та вазі
import re

variants_by_sort = {}

for pid, name, price in products:
    # Визначаємо сорт
    if '1 сорт' in name:
        sort = '1 сорт'
    elif '2 сорт' in name or '2сорт' in name:
        sort = '2 сорт'
    elif 'Еліт' in name or 'еліт' in name:
        sort = 'Еліт'
    else:
        sort = 'Без сорту'
    
    # Визначаємо вагу
    weight_match = re.search(r'(\d+)\s*г+р?а?м+', name)
    if weight_match:
        weight = weight_match.group(1) + 'г'
    else:
        weight = '?'
    
    # Визначаємо форму
    if 'порошок' in name.lower():
        form = 'Порошок'
    else:
        form = 'Цілі'
    
    if sort not in variants_by_sort:
        variants_by_sort[sort] = {}
    
    if weight not in variants_by_sort[sort]:
        variants_by_sort[sort][weight] = []
    
    variants_by_sort[sort][weight].append({
        'id': pid,
        'form': form,
        'price': price
    })

# Виводимо результат
for sort in ['1 сорт', '2 сорт', 'Еліт', 'Без сорту']:
    if sort not in variants_by_sort:
        continue
    
    print(f"\n{'='*80}")
    print(f"{sort.upper()}")
    print('='*80)
    
    for weight in ['1г', '50г', '100г', '200г']:
        if weight in variants_by_sort[sort]:
            variants = variants_by_sort[sort][weight]
            print(f"\n  {weight}:")
            for v in variants:
                print(f"    [{v['id']}] {v['form']} - {v['price']} UAH")
        else:
            print(f"\n  {weight}: ❌ НЕМАЄ")

print("\n" + "="*80)
print("ВИСНОВОК:")
print("="*80)
print("""
1 СОРТ:
  - Є тільки 1г (Цілі та Порошок по 10 UAH)
  - НЕМАЄ 50г, 100г, 200г

2 СОРТ:
  - Є всі ваги (1г, 50г, 100г, 200г)
  - Ціни: 8, 400, 800, 1500 UAH

ЕЛІТ:
  - Є всі ваги
  - Ціни: 12, 600, 1200, 2300 UAH

РІШЕННЯ:
Коли користувач вибирає "1 сорт" + "50г", потрібно або:
1. Показати що цей варіант недоступний
2. Розрахувати ціну: 10 UAH * 50 = 500 UAH (але це може бути неправильно)
3. Показати найближчий доступний варіант (1г за 10 UAH)

Найкраще рішення - показувати тільки доступні ваги для вибраного сорту.
""")

conn.close()
