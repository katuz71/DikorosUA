import sqlite3

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

print("="*80)
print("ШЛЯПКИ МУХОМОРУ ЧЕРВОНОГО - ПЕРЕВІРКА ЦІН")
print("="*80)

cursor.execute("""
    SELECT id, name, price, group_id
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%сорт%'
    ORDER BY name
""")

products = cursor.fetchall()
print(f"\nЗнайдено товарів: {len(products)}\n")

for pid, name, price, gid in products:
    print(f"[{pid}] {name}")
    print(f"  Ціна: {price} UAH | Group ID: {gid}")
    print()

# Перевіряємо групування
print("="*80)
print("ГРУПУВАННЯ ЗА GROUP_ID")
print("="*80)

cursor.execute("""
    SELECT group_id, COUNT(*) as cnt
    FROM products
    WHERE name LIKE '%Шляпки мухомору червоного%' AND name LIKE '%сорт%'
    GROUP BY group_id
    ORDER BY group_id
""")

for gid, cnt in cursor.fetchall():
    print(f"\nGroup {gid}: {cnt} товарів")
    cursor.execute("""
        SELECT id, name, price
        FROM products
        WHERE group_id = ? AND name LIKE '%Шляпки мухомору червоного%'
        ORDER BY price
    """, (gid,))
    
    for pid, name, price in cursor.fetchall():
        print(f"  [{pid}] {name[:70]}... - {price} UAH")

# Перевіряємо всі групи з варіантами
print("\n" + "="*80)
print("ВСІ ГРУПИ З ВАРІАНТАМИ (>1 товар)")
print("="*80)

cursor.execute("""
    SELECT group_id, COUNT(*) as cnt
    FROM products
    WHERE group_id IS NOT NULL
    GROUP BY group_id
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 15
""")

for gid, cnt in cursor.fetchall():
    cursor.execute("""
        SELECT id, name, price
        FROM products
        WHERE group_id = ?
        ORDER BY price
        LIMIT 3
    """, (gid,))
    
    products = cursor.fetchall()
    if products:
        print(f"\n🔸 Group {gid}: {cnt} варіантів")
        for pid, name, price in products:
            print(f"  [{pid}] {name[:70]}... - {price} UAH")

conn.close()
