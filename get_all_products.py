import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

# Отримуємо всі унікальні базові назви товарів
cursor.execute("""
    SELECT DISTINCT 
        CASE 
            WHEN name LIKE '%Шляпки мухомору%' THEN 'Шляпки мухомору червоного'
            WHEN name LIKE '%Мікродозінг%' OR name LIKE '%мікродозинг%' THEN 'Мікродозінг'
            WHEN name LIKE '%CBD%' THEN 'CBD олія'
            WHEN name LIKE '%Чага%' THEN 'Чага'
            WHEN name LIKE '%Трутовик%' OR name LIKE '%Рейші%' THEN 'Трутовик лакований (Рейші)'
            WHEN name LIKE '%Їжовик%' THEN 'Їжовик гребінчастий'
            WHEN name LIKE '%Кордицепс%' THEN 'Кордицепс'
            WHEN name LIKE '%Львина грива%' THEN 'Львина грива'
            WHEN name LIKE '%Шиїтаке%' THEN 'Шиїтаке'
            WHEN name LIKE '%Майтаке%' THEN 'Майтаке'
            WHEN name LIKE '%Веселка%' THEN 'Веселка'
            WHEN name LIKE '%настоянка%' OR name LIKE '%Настоянка%' THEN 'Настоянка'
            WHEN name LIKE '%Зерноміцелій%' THEN 'Зерноміцелій'
            ELSE SUBSTR(name, 1, 30)
        END as category,
        COUNT(*) as count
    FROM products
    GROUP BY category
    ORDER BY count DESC
""")

products = cursor.fetchall()

print("="*80)
print("КАТЕГОРІЇ ТОВАРІВ В БД:")
print("="*80)
for product, count in products:
    print(f"{product[:50]:50} - {count:3} товарів")

print(f"\n{'='*80}")
print(f"ВСЬОГО КАТЕГОРІЙ: {len(products)}")
print(f"{'='*80}")

conn.close()
