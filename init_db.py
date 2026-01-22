import sqlite3

def init_db():
    conn = sqlite3.connect('shop.db')
    cursor = conn.cursor()

    # 1. Создаем таблицу пользователей
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            phone TEXT PRIMARY KEY,
            bonus_balance INTEGER DEFAULT 0,
            total_spent REAL DEFAULT 0.0,
            referrer TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Создаем таблицу заказов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT,
            name TEXT,
            phone TEXT,
            city TEXT,
            cityRef TEXT,
            warehouse TEXT,
            warehouseRef TEXT,
            items TEXT,
            total REAL,
            totalPrice REAL,
            status TEXT DEFAULT 'New',
            payment_method TEXT DEFAULT 'cash',
            invoiceId TEXT,
            bonus_used INTEGER DEFAULT 0,
            date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 3. Создаем таблицу товаров
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            discount INTEGER DEFAULT 0,
            image TEXT,
            images TEXT,
            description TEXT,
            weight TEXT,
            ingredients TEXT,
            category TEXT,
            composition TEXT,
            usage TEXT,
            pack_sizes TEXT,
            old_price REAL,
            unit TEXT DEFAULT 'шт',
            variants TEXT,
            option_names TEXT,
            delivery_info TEXT,
            payment_info TEXT,
            return_info TEXT,
            contacts TEXT
        )
    ''')

    # 4. Создаем таблицу категорий
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )
    ''')
    
    # 5. Создаем таблицу баннеров
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            image_url TEXT,
            link_url TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # --- ОЧИЩАЕМ СТАРЫЕ ДАННЫЕ (ЧТОБЫ НЕ БЫЛО ДУБЛЕЙ) ---
    cursor.execute('DELETE FROM products')
    cursor.execute('DELETE FROM categories')
    cursor.execute('DELETE FROM banners')

    # --- ЗАПОЛНЯЕМ НОВЫМИ ТОВАРАМИ С РАБОЧИМИ КАРТИНКАМИ ---
    products = [
        (
            "Карпатський Чай", 
            120, 
            0, 
            "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600", # Новая ссылка
            "Натуральний трав'яний збір з екологічно чистих Карпат.", 
            "Трави та ягоди"
        ),
        (
            "Гірський Мед", 
            250, 
            0, 
            "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600", # Новая ссылка
            "Справжній мед з різнотрав'я.", 
            "Мед та солодощі"
        ),
        (
            "Набір 'Здоров'я'", 
            450, 
            15, 
            "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600", # Новая ссылка
            "Комплекс трав для зміцнення імунітету.", 
            "Набори"
        ),
        (
            "Іван-Чай Ферментований", 
            180, 
            0, 
            "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=600", # Новая ссылка
            "Класичний ферментований чай.", 
            "Трави та ягоди"
        )
    ]

    cursor.executemany('''
        INSERT INTO products (name, price, discount, image, description, category)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', products)
    
    # Добавляем категории
    categories = [("Трави та ягоди",), ("Мед та солодощі",), ("Набори",), ("Гриби",)]
    cursor.executemany('INSERT OR IGNORE INTO categories (name) VALUES (?)', categories)

    conn.commit()
    conn.close()
    print("✅ База данных успешно обновлена (новые картинки загружены).")

if __name__ == "__main__":
    init_db()