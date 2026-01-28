import sqlite3
import json

def check_orders():
    try:
        conn = sqlite3.connect('dikoros.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get last 5 orders
        rows = cur.execute("SELECT id, name, phone, user_phone, date, status FROM orders ORDER BY id DESC LIMIT 5").fetchall()
        
        print(f"--- LAst 5 ORDERS ({len(rows)}) ---")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"  Name: {row['name']}")
            print(f"  Phone (Delivery): '{row['phone']}'")
            print(f"  User Phone (Account): '{row['user_phone']}'")
            print(f"  Date: {row['date']}")
            print(f"  Status: {row['status']}")
            print("-" * 20)
            
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_orders()
