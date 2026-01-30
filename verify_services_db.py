import sqlite3

conn = sqlite3.connect('services/shop.db')
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f'Total products in services/shop.db: {total}')

cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE id BETWEEN 349 AND 354
ORDER BY id
""")

new_variants = cursor.fetchall()
print(f'\nНовые варианты 1 сорта ({len(new_variants)}):')
for r in new_variants:
    print(f'ID: {r[0]}, Price: {r[2]} грн, Name: {r[1][:80]}')

cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%1 сорт%'
ORDER BY id
""")

all_1sort = cursor.fetchall()
print(f'\nВсе варианты 1 сорта ({len(all_1sort)}):')
for r in all_1sort:
    print(f'ID: {r[0]}, Price: {r[2]} грн')

conn.close()
