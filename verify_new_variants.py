import sqlite3

conn = sqlite3.connect('services/shop.db')
cursor = conn.cursor()

cursor.execute("""
SELECT id, name, price 
FROM products 
WHERE name LIKE '%мухомор червоного%' AND name LIKE '%сорт%'
ORDER BY name
""")

rows = cursor.fetchall()

print("=== Все варианты мухомора с сортом ===\n")

sort_1 = []
sort_2 = []
sort_elit = []

for row in rows:
    if '1 сорт' in row[1]:
        sort_1.append(row)
    elif '2 сорт' in row[1] or '2сорт' in row[1]:
        sort_2.append(row)
    elif 'Еліт' in row[1]:
        sort_elit.append(row)

print(f"1 сорт ({len(sort_1)} товаров):")
for r in sort_1:
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

print(f"\n2 сорт ({len(sort_2)} товаров):")
for r in sort_2:
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
print("\n✅ Проверка завершена!")
