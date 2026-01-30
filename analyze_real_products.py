import sqlite3
import re
from collections import defaultdict

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

print("=" * 120)
print("📊 АНАЛИЗ РЕАЛЬНЫХ ТОВАРОВ ДЛЯ ГРУППИРОВКИ")
print("=" * 120)

# Получаем все товары
cursor.execute('SELECT id, name, price, category FROM products ORDER BY name')
all_products = cursor.fetchall()

print(f"\n🔢 Всего товаров в базе: {len(all_products)}\n")

# Статистика по категориям
cursor.execute('SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY COUNT(*) DESC')
categories = cursor.fetchall()

print("=" * 120)
print("📂 КАТЕГОРИИ")
print("=" * 120)
for cat in categories:
    print(f"   {cat[0]}: {cat[1]} товаров")

# Анализ названий для группировки
print("\n" + "=" * 120)
print("🔍 АНАЛИЗ НАЗВАНИЙ ДЛЯ АВТОМАТИЧЕСКОЙ ГРУППИРОВКИ")
print("=" * 120)

# Регулярные выражения для поиска атрибутов
patterns = {
    'weight': r'(\d+\s*(?:г|кг|мг|мл|шт|капсул))',
    'form': r'(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Шляпки|Зерноміцелій)',
    'year': r'\b(202[0-9])\b',
    'sort': r'(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])',
}

# Группируем товары по базовому названию
groups = defaultdict(list)

for product in all_products:
    pid, name, price, category = product
    
    # Упрощенная базовая группировка - убираем числа и единицы измерения
    base_name = name
    
    # Убираем фасовку
    base_name = re.sub(patterns['weight'], '', base_name)
    # Убираем форму
    base_name = re.sub(patterns['form'], '', base_name, flags=re.IGNORECASE)
    # Убираем год
    base_name = re.sub(patterns['year'], '', base_name)
    # Убираем сорт
    base_name = re.sub(patterns['sort'], '', base_name, flags=re.IGNORECASE)
    
    # Очищаем от лишних пробелов и знаков
    base_name = re.sub(r'\s+', ' ', base_name).strip()
    base_name = re.sub(r'[,.-]\s*$', '', base_name)
    base_name = re.sub(r'^\s*[,.-]', '', base_name)
    base_name = re.sub(r'\(\s*\)', '', base_name)
    
    groups[base_name].append((pid, name, price, category))

# Показываем группы с несколькими вариантами
print("\n🎯 ТОВАРЫ С ПОТЕНЦИАЛЬНЫМИ ВАРИАНТАМИ (2+ товара с похожим названием):\n")

variant_groups = {k: v for k, v in groups.items() if len(v) > 1}
variant_groups = dict(sorted(variant_groups.items(), key=lambda x: len(x[1]), reverse=True))

total_variants = 0
for base_name, products in list(variant_groups.items())[:20]:  # Показываем топ-20
    print(f"📦 {base_name}")
    print(f"   Вариантов: {len(products)}")
    total_variants += len(products)
    for pid, name, price, category in products[:5]:  # Показываем первые 5
        print(f"   - [{pid}] {name} → {price} грн ({category})")
    if len(products) > 5:
        print(f"   ... и еще {len(products) - 5} вариантов")
    print()

print("=" * 120)
print("📈 СТАТИСТИКА ГРУППИРОВКИ")
print("=" * 120)
print(f"   Всего товаров: {len(all_products)}")
print(f"   Уникальных базовых названий: {len(groups)}")
print(f"   Групп с вариантами (2+): {len(variant_groups)}")
print(f"   Товаров в группах с вариантами: {total_variants}")
print(f"   Одиночных товаров: {len(all_products) - total_variants}")

# Анализ атрибутов в названиях
print("\n" + "=" * 120)
print("🔬 АНАЛИЗ АТРИБУТОВ В НАЗВАНИЯХ")
print("=" * 120)

attr_stats = {
    'weight': 0,
    'form': 0,
    'year': 0,
    'sort': 0
}

for product in all_products:
    name = product[1]
    for attr, pattern in patterns.items():
        if re.search(pattern, name, re.IGNORECASE):
            attr_stats[attr] += 1

print(f"   Фасовка (г, кг, мл): {attr_stats['weight']} товаров ({attr_stats['weight']*100//len(all_products)}%)")
print(f"   Форма (Мелений, Цілі, Капсули): {attr_stats['form']} товаров ({attr_stats['form']*100//len(all_products)}%)")
print(f"   Год урожая (2023, 2024): {attr_stats['year']} товаров ({attr_stats['year']*100//len(all_products)}%)")
print(f"   Сорт (1 сорт, Еліт): {attr_stats['sort']} товаров ({attr_stats['sort']*100//len(all_products)}%)")

# Примеры товаров для ручной настройки вариантов
print("\n" + "=" * 120)
print("💡 РЕКОМЕНДАЦИИ")
print("=" * 120)
print(f"""
1. АВТОМАТИЧЕСКАЯ ГРУППИРОВКА работает для {len(variant_groups)} групп товаров
   - Система в database.ts распознает атрибуты в названиях
   - Товары автоматически группируются по базовому названию
   
2. РУЧНАЯ НАСТРОЙКА может потребоваться для:
   - Товаров со сложными комбинациями атрибутов
   - Наборов и комплектов
   - Товаров с нестандартными характеристиками
   
3. СЛЕДУЮЩИЕ ШАГИ:
   ✅ База данных содержит {len(all_products)} товаров
   ✅ Система группировки готова обработать {total_variants} товаров в {len(variant_groups)} группах
   🔧 Проверьте работу в приложении
   🔧 При необходимости добавьте ручные варианты для сложных товаров
""")

conn.close()
