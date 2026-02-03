import sqlite3
import json

def analyze():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    output = []
    output.append("Checking products table...")
    
    # Check 174 specifically
    row = conn.execute("SELECT * FROM products WHERE id=174").fetchone()
    if row:
        d = dict(row)
        output.append("\n=== Product 174 ===")
        output.append(f"Name: {d['name']}")
        output.append(f"Description: {bool(d.get('description'))}")
        output.append(f"Composition: {bool(d.get('composition'))}")
        output.append(f"Usage: {bool(d.get('usage'))}")
        output.append(f"Option Names: {d.get('option_names')}")
        output.append(f"Variants JSON: {d.get('variants')[:100] if d.get('variants') else 'None'}...")
    else:
        output.append("Product 174 not found")

    with open('db_analysis.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(output))

    conn.close()

if __name__ == "__main__":
    analyze()
