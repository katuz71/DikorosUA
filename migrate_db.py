import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env!")
        return
    
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("Adding new columns to 'products' table...")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_sku TEXT;")
        cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_name TEXT;")
        
        conn.commit()
        print("✅ Migration successful! Columns 'parent_sku' and 'variant_name' are ready.")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate()
