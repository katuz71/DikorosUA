import sqlite3
import json

def analyze():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    
    report = []
    
    # Check total count
    count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    report.append(f"Total products: {count}")
    
    # Products with no description
    no_desc = conn.execute("SELECT id, name FROM products WHERE description IS NULL OR description = ''").fetchall()
    report.append(f"\nProducts with NO description ({len(no_desc)}):")
    for p in no_desc[:20]:
        report.append(f" - {p['id']}: {p['name']}")

    # Products with variants but no option_names
    broken_multi = conn.execute("SELECT id, name, variants, option_names FROM products WHERE variants IS NOT NULL AND variants != '[]' AND variants != '' AND (option_names IS NULL OR option_names = '')").fetchall()
    report.append(f"\nProducts with variants but NO option_names ({len(broken_multi)}):")
    for p in broken_multi[:20]:
        report.append(f" - {p['id']}: {p['name']}")
        
    # Check 174 specifically
    p174 = conn.execute("SELECT * FROM products WHERE id=174").fetchone()
    if p174:
        d = dict(p174)
        report.append(f"\nProduct 174: {d['name']}")
        report.append(f"  Desc length: {len(d['description']) if d['description'] else 0}")
        report.append(f"  Option Names: {d['option_names']}")
        report.append(f"  Variants: {d['variants']}")
    
    with open('audit_report.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))

    conn.close()

if __name__ == "__main__":
    analyze()
