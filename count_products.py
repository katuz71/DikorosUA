import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f'Total products: {total}')

cursor.execute("SELECT COUNT(*) FROM products WHERE name LIKE '%мухомор%'")
mushroom = cursor.fetchone()[0]
print(f'Mushroom products: {mushroom}')

cursor.execute("SELECT id, name, price FROM products WHERE id BETWEEN 348 AND 360")
recent = cursor.fetchall()
print(f'\nПоследние добавленные товары:')
for r in recent:
    print(f'ID: {r[0]}, Price: {r[2]}, Name: {r[1][:80]}')

conn.close()
