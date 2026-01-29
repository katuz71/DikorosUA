import sqlite3
import os

db_path = r'c:\Work\DikorosUA\services\dikoros.db'

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get table info for 'products'
    cursor.execute("PRAGMA table_info(products)")
    columns = cursor.fetchall()
    
    print("Columns in 'products' table:")
    for col in columns:
        print(col)
        
    # Get first 5 rows to see sample data
    cursor.execute("SELECT * FROM products LIMIT 5")
    rows = cursor.fetchall()
    print("\nSample data (first 5 rows):")
    for row in rows:
        print(row)
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
