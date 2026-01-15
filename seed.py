import sqlite3

DB_NAME = 'shop.db'

def seed_database():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # 1. Сначала СОЗДАЕМ таблицы, если их нет (чтобы не было ошибки)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                image TEXT,
                description TEXT,
                weight TEXT,
                ingredients TEXT,
                category TEXT,
                composition TEXT,
                usage TEXT,
                pack_sizes TEXT,
                old_price REAL,
                unit TEXT DEFAULT 'шт',
                variants TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                name TEXT UNIQUE
            )
        ''')

        print("🧹 Очистка базы данных...")
        cursor.execute("DELETE FROM products")
        cursor.execute("DELETE FROM categories")
        # Сброс счетчиков ID
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='products'")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='categories'")

        # 2. Создаем категории (На украинском)
        categories = ["Мікродозинг", "Сушені гриби"]
        print(f"📂 Добавляем категории: {', '.join(categories)}")
        
        for cat in categories:
            try:
                cursor.execute("INSERT INTO categories (name) VALUES (?)", (cat,))
            except:
                pass # Если категория уже есть
        
        # 3. Товари (На украинском)
        products = [
            # --- КАТЕГОРИЯ: СУШЕНІ ГРИБИ ---
            {
                "name": "Мухомор Червоний (Капелюшки)",
                "price": 800,
                "category": "Сушені гриби",
                "description": "Відбірні капелюшки червоного мухомора (Amanita Muscaria). Зібрані в екологічно чистих лісах Карпат. Правильна сушка при 35°C зберігає всі активні компоненти. Вакуумна упаковка.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "50 г",
                "old_price": 950
            },
            {
                "name": "Їжовик Гребінчастий (Зерноміцелій)",
                "price": 650,
                "category": "Сушені гриби",
                "description": "Зерноміцелій Їжовика (Lion's Mane). Потужний природний ноотроп. Покращує пам'ять, концентрацію та сприяє відновленню нервових клітин. Ідеально для чаю або додавання в їжу.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "100 г",
                "old_price": 0
            },
            
            # --- КАТЕГОРИЯ: МІКРОДОЗИНГ ---
            {
                "name": "Мухомор Пантерний (Капсули)",
                "price": 1200,
                "category": "Мікродозинг",
                "description": "Курс мікродозингу пантерного мухомора. 60 капсул по 0.35г. Має значно сильніший ефект у порівнянні з червоним. Для глибокої роботи з підсвідомістю та зняття стресу.",
                "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp",
                "unit": "60 шт",
                "old_price": 1400
            },
            {
                "name": "Кордицепс Мілітаріс (Power+)",
                "price": 950,
                "category": "Мікродозинг",
                "description": "Природний енергетик у капсулах. Підвищує витривалість, покращує лібідо та зміцнює імунітет. Ідеально підходить для спортсменів та активних людей.",
                "image": "https://dikoros-ua.com/content/images/6/480x480l50nn0/korditseps-militaris-100-g-plodovye-tela-97258334464821.jpg",
                "unit": "90 шт",
                "old_price": 0
            }
        ]

        print("🍄 Добавляем товары в базу...")
        for p in products:
            cursor.execute("""
                INSERT INTO products (name, price, category, description, image, unit, old_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (p['name'], p['price'], p['category'], p['description'], p['image'], p['unit'], p['old_price']))

        conn.commit()
        conn.close()
        print("✅ Готово! База создана и наполнена.")

    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    seed_database()