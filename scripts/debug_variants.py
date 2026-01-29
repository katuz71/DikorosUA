import sqlite3
import os
import json

db_path = r'c:\Work\DikorosUA\services\dikoros.db'

print(f"Checking database at: {db_path}")

if not os.path.exists(db_path):
    print(f"❌ Database not found at {db_path}")
    # Try searching nearby
    for root, dirs, files in os.walk(r'c:\Work\DikorosUA'):
        for file in files:
            if file.endswith('.db'):
                print(f"Found candidate: {os.path.join(root, file)}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    # Allow accessing columns by name
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check columns
    cursor.execute("PRAGMA table_info(products)")
    columns = [row['name'] for row in cursor.fetchall()]
    print(f"📋 Columns: {columns}")
    
    needed_cols = ['id', 'name']
    if 'pack_sizes' in columns: needed_cols.append('pack_sizes')
    if 'variants' in columns: needed_cols.append('variants')
    if 'price' in columns: needed_cols.append('price')
    
    query = f"SELECT {', '.join(needed_cols)} FROM products ORDER BY id DESC LIMIT 5"
    print(f"🔍 Query: {query}")
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    print("\n📦 Latest 5 Products Data:")
    for row in rows:
        r = dict(row)
        print("-" * 40)
        print(f"ID: {r.get('id')} | Name: {r.get('name')}")
        print(f"Price: {r.get('price')}")
        if 'pack_sizes' in r:
            print(f"pack_sizes (raw): '{r['pack_sizes']}' Type: {type(r['pack_sizes'])}")
        if 'variants' in r:
            print(f"variants (raw): '{r['variants']}' Type: {type(r['variants'])}")
            
    conn.close()
except Exception as e:
    print(f"🔥 Error: {e}")
