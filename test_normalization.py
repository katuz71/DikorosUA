import re

def normalizeProduct(name):
    regexes = {
        'year': r'\b(202[0-9])\b',
        'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
        'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Зерноміцелій)',
        'weight': r'(\d+\s*(?:грам|грамм|г\b|кг|мг|мл|шт|капсул))'
    }
    
    attributes = {}
    baseName = name
    
    # Year
    yMatch = re.search(regexes['year'], name, re.IGNORECASE)
    if yMatch:
        attributes['year'] = yMatch.group(0)
        baseName = re.sub(regexes['year'], '', baseName)
    
    # Sort
    sMatch = re.search(regexes['sort'], name, re.IGNORECASE)
    if sMatch:
        sortValue = sMatch.group(0)
        sortValue = re.sub(r'(\d+)сорт', r'\1 сорт', sortValue, flags=re.IGNORECASE)
        attributes['sort'] = sortValue
        baseName = re.sub(regexes['sort'], '', baseName, flags=re.IGNORECASE)
    
    # Form
    fMatch = re.search(regexes['form'], name, re.IGNORECASE)
    if fMatch:
        attributes['form'] = fMatch.group(0)
        baseName = re.sub(regexes['form'], '', baseName, flags=re.IGNORECASE)
    elif 'сушен' in name.lower():
        attributes['form'] = 'Без обробки'
    
    # Weight
    wMatch = re.search(regexes['weight'], name, re.IGNORECASE)
    if wMatch:
        weightValue = wMatch.group(0)
        weightValue = re.sub(r'(\d+)\s*грам', r'\1 грам', weightValue, flags=re.IGNORECASE)
        attributes['weight'] = weightValue
        baseName = re.sub(regexes['weight'], '', baseName, flags=re.IGNORECASE)
    
    baseName = re.sub(r'\s+', ' ', baseName).strip()
    baseName = re.sub(r'\s*,\s*$', '', baseName).strip()
    
    return baseName, attributes

# Тестируем
names = [
    'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 1 грам',
    'Шляпки мухомору червоного (Amanita muscaria) сушені, 2 сорт - 1 грам',
    'Шляпки мухомору червоного (Amanita muscaria) сушені, 1 сорт - 50 грам',
    'Шляпки мухомору червоного (Amanita muscaria) сушені, порошок 1 сорт - 100 грам'
]

print('Результаты нормализации:\n')
for name in names:
    base, attrs = normalizeProduct(name)
    print(f'Название: {name[:60]}...')
    print(f'  Базовое: [{base}]')
    print(f'  Атрибуты: {attrs}')
    print()
