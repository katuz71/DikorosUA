import sqlite3

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%1 сорт%'
ORDER BY price
""")

rows = cursor.fetchall()

print(f"=== Варианты 1 сорта в shop.db ({len(rows)} товаров) ===\n")

for r in rows:
    weight = ''
    if '1 грам' in r[1]:
        weight = '1 грам'
    elif '50 грам' in r[1]:
        weight = '50 грам'
    elif '100 грам' in r[1]:
        weight = '100 грам'
    elif '200 грам' in r[1]:
        weight = '200 грам'
    
    form = 'Без обробки'
    if 'порошок' in r[1]:
        form = 'Порошок'
    
    print(f"  {weight:10} | {form:15} | {r[2]:5} грн | ID: {r[0]}")

conn.close()
