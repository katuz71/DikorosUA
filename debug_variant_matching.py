import sqlite3
import re

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("DEBUG: ШЛЯПКИ МУХОМОРУ - ЯК ПАРСЯТЬСЯ АТРИБУТИ")
print("="*80)

# Отримуємо всі шляпки мухомора з 1 сортом
cursor.execute("""
    SELECT id, name, price, group_id
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%1 сорт%'
    ORDER BY price
""")

products = cursor.fetchall()

# Regex з database.ts
regexes = {
    'sort': re.compile(r'(\d\s*сорт|сорт\s*еліт|еліт|вищий\s*сорт|вищий\s*гатунок|преміум)', re.IGNORECASE),
    'form': re.compile(r'(порошок|мелен[іийа]|ціл[іа]|капсул[иа]?|зерноміцелій|ламан[іий]|шматочки)', re.IGNORECASE),
    'weight': re.compile(r'[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+', re.IGNORECASE),
}

print("\nПарсинг атрибутів для кожного товару:\n")

for pid, name, price, gid in products:
    print(f"[{pid}] {name}")
    print(f"  Ціна: {price} UAH | Group: {gid}")
    
    # Парсимо сорт
    sort_match = regexes['sort'].search(name)
    if sort_match:
        sort_value = sort_match.group(0).strip()
        sort_value = re.sub(r'(\d)\s*сорт', r'\1 сорт', sort_value, flags=re.IGNORECASE)
        sort_value = re.sub(r'сорт\s*', '', sort_value, flags=re.IGNORECASE)
        sort_value = sort_value.capitalize()
        if sort_value.lower().startswith('еліт'):
            sort_value = 'Еліт'
        if re.match(r'^\d', sort_value):
            sort_value = sort_value.replace(' ', '') + ' сорт'
        print(f"  ✅ Сорт: '{sort_value}'")
    else:
        print(f"  ❌ Сорт не знайдено")
    
    # Парсимо форму
    form_match = regexes['form'].search(name)
    if form_match:
        form_value = form_match.group(0).lower()
        if 'порошок' in form_value or 'мелен' in form_value:
            form_value = 'Порошок'
        elif 'ціл' in form_value:
            form_value = 'Цілі'
        print(f"  ✅ Форма: '{form_value}'")
    elif 'сушен' in name.lower() and 'порошок' not in name.lower():
        print(f"  ✅ Форма: 'Цілі' (за замовчуванням)")
    else:
        print(f"  ❌ Форма не знайдена")
    
    # Парсимо вагу
    weight_match = regexes['weight'].search(name)
    if weight_match:
        before = name[:weight_match.start()]
        if not re.search(r'по\s+[\d,]*$', before, re.IGNORECASE):
            weight_value = f"{weight_match.group(1)} грам"
            print(f"  ✅ Вага: '{weight_value}'")
        else:
            print(f"  ⚠️ Вага після 'по' - пропускаємо")
    else:
        print(f"  ❌ Вага не знайдена")
    
    print()

print("="*80)
print("ВИСНОВОК:")
print("="*80)
print("""
Проблема: normalizeProduct парсить сорт як '1 сорт', але в назві може бути:
- "1 сорт" (з пробілом)
- "1сорт" (без пробілу)

Також може бути проблема з формою:
- "сушені" парсяться як "Цілі"
- "порошок" парсяться як "Порошок"

Потрібно перевірити що саме зберігається в attrs після normalizeProduct.
""")

conn.close()
