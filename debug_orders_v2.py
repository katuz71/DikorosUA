import sqlite3
import json
import os

DB_NAME = 'shop.db'

def check_orders():
    print(f"Checking {DB_NAME}...")
    if not os.path.exists(DB_NAME):
        print(f"ERROR: {DB_NAME} does not exist!")
        return

    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Check if table exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'")
        if not cur.fetchone():
            print("ERROR: Table 'orders' does not exist")
            conn.close()
            return
            
        # Check columns
        cur.execute("PRAGMA table_info(orders)")
        columns = [row['name'] for row in cur.fetchall()]
        print(f"Columns: {columns}")
        
        if 'user_phone' not in columns:
            print("WARNING: 'user_phone' column is MISSING!")
        
        # Get last 5 orders
        rows = cur.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 5").fetchall()
        
        print(f"\n--- LAST 5 ORDERS ({len(rows)}) ---")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"  Name: {row['name']}")
            print(f"  Phone (Delivery): '{row['phone']}'")
            if 'user_phone' in columns:
                print(f"  User Phone (Account): '{row['user_phone']}'")
            print(f"  Date: {row['date']}")
            print(f"  Status: {row['status']}")
            print("-" * 20)
            
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_orders()
