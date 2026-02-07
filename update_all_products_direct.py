#!/usr/bin/env python3
"""
Прямое обновление описаний товаров через БД
"""

import sqlite3
from generate_product_descriptions import format_product_description

# Категории товаров с их шаблонами
CATEGORY_TEMPLATES = {
    'боровик': 'mushroom',
    'білий гриб': 'mushroom',
    'підберезник': 'mushroom',
    'лисичк': 'mushroom',
    'опеньк': 'mushroom',
    'гриб': 'mushroom',
    'маринован': 'mushroom',
    
    'чай': 'herb',
    'трав': 'herb',
    'збір': 'herb',
    'м\'ята': 'herb',
    'ромашк': 'herb',
    'полуниц': 'herb',
    'малин': 'herb',
    'кропив': 'herb',
    'чорниц': 'herb',
    'сушен': 'herb',
    
    'варення': 'jam',
    'джем': 'jam',
    'конфітюр': 'jam',
    'обліпих': 'jam',
    
    'мед': 'honey',
}

def detect_category(product_name: str) -> str:
    """Определяет категорию товара по названию"""
    name_lower = product_name.lower()
    
    for keyword, category in CATEGORY_TEMPLATES.items():
        if keyword in name_lower:
            return category
    
    return 'herb'  # По умолчанию

def main():
    print("🚀 Прямое обновление описаний товаров через БД\n")
    
    # Подключаемся к БД
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Получаем товары без описаний или с короткими описаниями
    cursor.execute("""
        SELECT id, name, description 
        FROM products 
        WHERE description IS NULL OR LENGTH(TRIM(description)) < 50
        ORDER BY id
    """)
    
    products = cursor.fetchall()
    
    if not products:
        print("✅ Все товары уже имеют описания!")
        conn.close()
        return
    
    print(f"📝 Найдено товаров без описания: {len(products)}\n")
    
    # Показываем примеры
    print("Примеры товаров:")
    for p in products[:10]:
        category = detect_category(p['name'])
        print(f"   • {p['name']} (ID: {p['id']}) → {category}")
    
    if len(products) > 10:
        print(f"   ... и ещё {len(products) - 10}")
    
    print("\n" + "="*60)
    confirm = input(f"\n💡 Обновить {len(products)} товаров? (y/N): ")
    
    if confirm.lower() != 'y':
        print("❌ Отменено")
        conn.close()
        return
    
    # Обновляем
    print("\n🔄 Начинаем обновление...\n")
    
    updated = 0
    failed = 0
    
    for i, product in enumerate(products, 1):
        product_id = product['id']
        product_name = product['name']
        
        print(f"[{i}/{len(products)}] {product_name}...", end=" ")
        
        try:
            # Определяем категорию
            category = detect_category(product_name)
            
            # Генерируем описание
            descriptions = format_product_description(product_name, category)
            
            # Обновляем в БД
            cursor.execute("""
                UPDATE products 
                SET description = ?,
                    delivery_info = ?,
                    return_info = ?
                WHERE id = ?
            """, (
                descriptions['description'],
                descriptions['delivery_info'],
                descriptions['return_info'],
                product_id
            ))
            
            conn.commit()
            print("✅")
            updated += 1
            
        except Exception as e:
            print(f"❌ {str(e)}")
            failed += 1
    
    # Итоги
    print("\n" + "="*60)
    print(f"\n📊 Результаты:")
    print(f"   ✅ Обновлено: {updated}")
    print(f"   ❌ Ошибок: {failed}")
    print(f"   📦 Всего обработано: {len(products)}")
    
    if updated > 0:
        print(f"\n🎉 Успешно обновлено {updated} товаров!")
    
    conn.close()

if __name__ == '__main__':
    main()
