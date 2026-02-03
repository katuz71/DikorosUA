import sqlite3
import json

def fix_metadata():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    print("🚀 Starting database metadata fix...")
    
    # 1. Fix missing option_names for products with variants
    products = c.execute("SELECT id, name, variants, option_names FROM products WHERE variants IS NOT NULL AND variants != '[]' AND variants != ''").fetchall()
    
    fixed_count = 0
    for p in products:
        if not p['option_names'] or p['option_names'].strip() == "":
            try:
                variants_list = json.loads(p['variants'])
                if not variants_list: continue
                
                # Get first variant to guess structure
                v = variants_list[0]
                v_str = str(v.get('name') or v.get('size') or "")
                
                if "|" in v_str:
                    parts_count = len(v_str.split('|'))
                    new_option_names = " | ".join([f"Опція {i+1}" for i in range(parts_count)])
                    # Specific guess for common patterns
                    if parts_count == 2:
                        new_option_names = "Вага | Сорт" # Very common in this shop
                    
                    print(f"✅ Fixed {p['id']} ({p['name']}): Empty option_names -> '{new_option_names}'")
                    c.execute("UPDATE products SET option_names = ? WHERE id = ?", (new_option_names, p['id']))
                    fixed_count += 1
                else:
                    # Single dimension
                    new_option_names = "Варіант"
                    print(f"✅ Fixed {p['id']} ({p['name']}): Single variant -> '{new_option_names}'")
                    c.execute("UPDATE products SET option_names = ? WHERE id = ?", (new_option_names, p['id']))
                    fixed_count += 1
            except Exception as e:
                print(f"❌ Error fixing {p['id']}: {e}")

    # 2. Check for missing descriptions
    no_desc = c.execute("SELECT COUNT(*) FROM products WHERE description IS NULL OR description = ''").fetchone()[0]
    print(f"\n📢 Found {no_desc} products with NO description.")

    conn.commit()
    conn.close()
    print(f"\n✨ Done! Fixed {fixed_count} products.")

if __name__ == "__main__":
    fix_metadata()
