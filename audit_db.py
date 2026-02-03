import sqlite3
import json

def analyze():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    print("Checking database for missing data...")
    
    # 1. Products with no descriptions
    no_desc = conn.execute("SELECT id, name FROM products WHERE description IS NULL OR description = ''").fetchall()
    print(f"\n[!] Products with NO description ({len(no_desc)}):")
    for p in no_desc[:5]:
        print(f" - {p['id']}: {p['name']}")
    if len(no_desc) > 5: print(" ... and more")

    # 2. Products with variants but NO option_names (breaks multi-variability)
    broken_multi = conn.execute("SELECT id, name, variants, option_names FROM products WHERE variants IS NOT NULL AND variants != '[]' AND (option_names IS NULL OR option_names = '')").fetchall()
    print(f"\n[!] Products with variants but NO option_names ({len(broken_multi)}):")
    for p in broken_multi[:5]:
        print(f" - {p['id']}: {p['name']} (Variants hint: {p['variants'][:50]}...)")
    if len(broken_multi) > 5: print(" ... and more")

    # 3. Sample product 174 (the one mentioned before)
    p174 = conn.execute("SELECT * FROM products WHERE id=174").fetchone()
    if p174:
        d = dict(p174)
        print("\n=== Detail for 174 ===")
        print(f"Name: {d['name']}")
        print(f"Desc: {bool(d['description'])}")
        print(f"Option Names: {d['option_names']}")
        print(f"Variants: {d['variants']}")
    else:
        print("\n[!] Product 174 not found!")

    conn.close()

if __name__ == "__main__":
    analyze()
