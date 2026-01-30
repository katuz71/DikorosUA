import sqlite3
import re

conn = sqlite3.connect('services/dikoros.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM products WHERE name LIKE '%мухомору червоного%' AND name LIKE '%Шляпки%'")
rows = cursor.fetchall()

print("Форматы веса в названиях мухомора:")
for row in rows:
    name = row[0]
    # Ищем разные форматы веса
    weight_patterns = [
        re.search(r'(\d+)\s*(грам|грамм|гр|г)\b', name, re.IGNORECASE),
        re.search(r'(\d+)(г|гр)\b', name, re.IGNORECASE),
        re.search(r'-\s*(\d+)\s*(грам|г)', name, re.IGNORECASE),
    ]
    
    found = None
    for p in weight_patterns:
        if p:
            found = p.group(0)
            break
    
    print(f"  {name[:70]}")
    print(f"    -> Вес: {found}")

conn.close()
