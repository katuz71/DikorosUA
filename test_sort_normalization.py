import re

# Копия функции normalizeProduct из database.ts
def normalize_product(name):
    regexes = {
        'year': r'\b(202[0-9])\b',
        'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
        'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Зерноміцелій)',
        'weight': r'(\d+\s*(?:грам|грамм|г\b|кг|мг|мл|шт|капсул))'
    }
    
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
        sort_value = s_match.group(0)
        # Normalize: "2сорт" → "2 сорт"
        sort_value = re.sub(r'(\d+)сорт', r'\1 сорт', sort_value, flags=re.IGNORECASE)
        attributes['sort'] = sort_value
        base_name = base_name.replace(s_match.group(0), '')
    
    # Form
    f_match = re.search(regexes['form'], name, re.IGNORECASE)
    if f_match:
        attributes['form'] = f_match.group(0)
        base_name = base_name.replace(f_match.group(0), '')
    elif 'сушен' in name.lower():
        attributes['form'] = 'Без обробки'
    
    # Weight
    w_match = re.search(regexes['weight'], name, re.IGNORECASE)
    if w_match:
        weight_value = w_match.group(0)
        # Normalize: "50грам" → "50 грам"
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

# Тестовые товары
test_products = [
    ("ID: 75", "Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 1 грам", 10),
    ("ID: 76", "Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 1 грам", 10),
    ("ID: 77", "Шляпки мухомору червоного (Amanita muscaria) сушені, 2 сорт - 1 грам", 8),
    ("ID: 78", "Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 2 сорт - 1 грам", 8),
]

print("=== Тест нормализации сорта ===\n")

for id_str, name, price in test_products:
    base_name, attrs = normalize_product(name)
    print(f"{id_str} (Price: {price} грн)")
    print(f"  Name: {name}")
    print(f"  Base: {base_name}")
    print(f"  Attrs: {attrs}")
    print()

print("\n=== Проверка: будут ли они в одной группе? ===")
groups = {}
for id_str, name, price in test_products:
    base_name, attrs = normalize_product(name)
    if base_name not in groups:
        groups[base_name] = []
    groups[base_name].append({
        'id': id_str,
        'price': price,
        'attrs': attrs
    })

for base_name, variants in groups.items():
    print(f"\nГруппа: {base_name}")
    print(f"Варианты ({len(variants)}):")
    for v in variants:
        print(f"  {v['id']}: {v['attrs']} -> {v['price']} грн")
