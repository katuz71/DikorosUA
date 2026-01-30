import sqlite3
import json

conn = sqlite3.connect('shop.db')
cursor = conn.cursor()

cursor.execute('SELECT id, name, price, category, variants, option_names FROM products LIMIT 15')
rows = cursor.fetchall()

print('=' * 120)
print(f"{'ID':<5} | {'Name':<40} | {'Price':<8} | {'Category':<15} | {'Variants':<20} | {'Option Names':<15}")
print('=' * 120)

for r in rows:
    variant_str = str(r[4])[:20] if r[4] else "None"
    option_str = str(r[5])[:15] if r[5] else "None"
    name_str = str(r[1])[:40] if r[1] else ""
    category_str = str(r[3])[:15] if r[3] else ""
    print(f"{r[0]:<5} | {name_str:<40} | {r[2]:<8} | {category_str:<15} | {variant_str:<20} | {option_str:<15}")

print('\n' + '=' * 120)
print('Detailed Variants Analysis:')
print('=' * 120)

cursor.execute('SELECT id, name, variants, option_names FROM products WHERE variants IS NOT NULL AND variants != ""')
variant_rows = cursor.fetchall()

for r in variant_rows[:5]:
    print(f"\nProduct ID: {r[0]}")
    print(f"Name: {r[1]}")
    print(f"Option Names: {r[3]}")
    if r[2]:
        try:
            variants = json.loads(r[2])
            print(f"Variants ({len(variants)} total):")
            for v in variants:
                print(f"  - {v}")
        except:
            print(f"Variants (raw): {r[2]}")

conn.close()
