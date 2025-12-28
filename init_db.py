import sqlite3
import os

def init_db():
    db_path = os.path.join(os.getcwd(), 'shop.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Создаем таблицу товаров
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            image TEXT,
            description TEXT
        )
    ''')
    
    # Начальные данные
    initial_products = [
        ('Омега-3 Gold', 1200, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600', 'Высококачественная Омега-3.'),
        ('Витамин C 1000мг', 650, 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd0?w=600', 'Укрепление иммунитета.'),
        ('Коллаген Пептидный', 2500, 'https://images.unsplash.com/photo-1598449356475-b9f71db7d847?w=600', 'Для молодости кожи.')
    ]
    
    cursor.executemany('INSERT INTO products (name, price, image, description) VALUES (?,?,?,?)', initial_products)
    
    # Добавляем колонку payment_method в таблицу orders, если она не существует
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'")
        conn.commit()
        print("Колонка payment_method успешно добавлена в таблицу orders!")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("Колонка payment_method уже существует в таблице orders.")
        else:
            # Таблица orders может не существовать, это нормально
            print(f"Таблица orders не существует или другая ошибка: {e}")
    
    conn.commit()
    conn.close()
    print("База данных shop.db успешно создана в " + db_path)

if __name__ == "__main__":
    init_db()

