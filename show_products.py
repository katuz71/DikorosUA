import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

# Общая статистика
cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f"\n{'='*100}")
print(f"📊 ВСЕГО ТОВАРОВ В БАЗЕ: {total}")
print(f"{'='*100}\n")

# Статистика по категориям
cursor.execute('SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY COUNT(*) DESC')
categories = cursor.fetchall()
print("📂 КАТЕГОРИИ:")
for cat, count in categories:
    print(f"   {cat}: {count} товаров")

# Примеры товаров
print(f"\n{'='*100}")
print("📦 ПРИМЕРЫ ТОВАРОВ (первые 15):")
print(f"{'='*100}\n")

cursor.execute('SELECT id, name, price, category FROM products LIMIT 15')
products = cursor.fetchall()

for p in products:
    pid, name, price, category = p
    print(f"{pid:3d} | {name[:60]:60s} | {price:6d} грн | {category}")

# Поиск товаров с похожими названиями (потенциальные варианты)
print(f"\n{'='*100}")
print("🔍 ПОИСК ТОВАРОВ С ВАРИАНТАМИ:")
print(f"{'='*100}\n")

cursor.execute('''
    SELECT name, COUNT(*) as cnt 
    FROM products 
    GROUP BY SUBSTR(name, 1, 20) 
    HAVING cnt > 1 
    ORDER BY cnt DESC 
    LIMIT 10
''')

similar = cursor.fetchall()
for name_prefix, count in similar:
    print(f"   '{name_prefix[:40]}...' - {count} похожих товаров")
    
    # Показываем эти товары
    cursor.execute('SELECT id, name, price FROM products WHERE name LIKE ? LIMIT 5', (name_prefix[:20] + '%',))
    variants = cursor.fetchall()
    for vid, vname, vprice in variants:
        print(f"      [{vid}] {vname} - {vprice} грн")
    print()

conn.close()
