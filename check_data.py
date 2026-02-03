import sqlite3
import json

def analyze():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    print("Checking products table...")
    
    # Check 174 specifically
    row = conn.execute("SELECT * FROM products WHERE id=174").fetchone()
    if row:
        d = dict(row)
        print("\n=== Product 174 ===")
        print(f"Name: {d['name']}")
        print(f"Description: {bool(d.get('description'))} (length: {len(d['description']) if d.get('description') else 0})")
        print(f"Composition: {bool(d.get('composition'))}")
        print(f"Usage: {bool(d.get('usage'))}")
        print(f"Option Names: {d.get('option_names')}")
        print(f"Variants JSON: {d.get('variants')[:100] if d.get('variants') else 'None'}...")
        
        if d.get('variants'):
            try:
                variants = json.loads(d['variants'])
                print(f"Parsed Variants count: {len(variants)}")
                if len(variants) > 0:
                    print(f"First variant keys: {variants[0].keys()}")
                    print(f"First variant data: {variants[0]}")
            except Exception as e:
                print(f"Error parsing variants: {e}")
    else:
        print("Product 174 not found")

    # Check some random products with variants
    print("\n=== Sample Products with Variants ===")
    rows = conn.execute("SELECT id, name, option_names, variants FROM products WHERE variants IS NOT NULL AND variants != '' LIMIT 3").fetchall()
    for r in rows:
        print(f"ID: {r['id']}, Name: {r['name']}")
        print(f"  Option Names: {r['option_names']}")
        print(f"  Variants: {r['variants'][:50]}...")

    conn.close()

if __name__ == "__main__":
    analyze()
