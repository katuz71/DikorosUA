import sqlite3
import json

DB_NAME = 'shop.db'

def seed_database_with_variants():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        print("🧹 Очистка базы данных...")
        cursor.execute("DELETE FROM products")
        cursor.execute("DELETE FROM categories")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='products'")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='categories'")

        # Категории
        categories = ["Мікродозинг", "Сушені гриби", "Екстракти", "Чаї"]
        print(f"📂 Добавляем категории: {', '.join(categories)}")
        
        for cat in categories:
            try:
                cursor.execute("INSERT INTO categories (name) VALUES (?)", (cat,))
            except:
                pass

        # ========================================
        # ПІДХІД 1: АВТОМАТИЧНЕ ГРУПУВАННЯ
        # Товари з різними фасуваннями, формами, роками
        # ========================================
        
        auto_grouped_products = [
            # Мухомор Червоний - різні фасування та форми
            {
                "name": "Мухомор Червоний Шляпки 50 г",
                "price": 450,
                "category": "Сушені гриби",
                "description": "Відбірні капелюшки червоного мухомора. Зібрані в Карпатах. Сушка при 35°C.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "г",
                "old_price": 550
            },
            {
                "name": "Мухомор Червоний Шляпки 100 г",
                "price": 800,
                "category": "Сушені гриби",
                "description": "Відбірні капелюшки червоного мухомора. Зібрані в Карпатах. Сушка при 35°C.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "г",
                "old_price": 950
            },
            {
                "name": "Мухомор Червоний Шляпки 250 г",
                "price": 1800,
                "category": "Сушені гриби",
                "description": "Відбірні капелюшки червоного мухомора. Зібрані в Карпатах. Сушка при 35°C.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "г",
                "old_price": 2100
            },
            {
                "name": "Мухомор Червоний Мелений 50 г",
                "price": 400,
                "category": "Сушені гриби",
                "description": "Мелений червоний мухомор. Зручно дозувати. Ідеально для чаю.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "г",
                "old_price": 500
            },
            {
                "name": "Мухомор Червоний Мелений 100 г",
                "price": 700,
                "category": "Сушені гриби",
                "description": "Мелений червоний мухомор. Зручно дозувати. Ідеально для чаю.",
                "image": "https://dikoros-ua.com/content/images/46/480x480l50nn0/45495535574345.webp",
                "unit": "г",
                "old_price": 850
            },
            
            # Їжовик - різні форми
            {
                "name": "Їжовик Гребінчастий Зерноміцелій 100 г",
                "price": 650,
                "category": "Сушені гриби",
                "description": "Зерноміцелій Їжовика (Lion's Mane). Потужний ноотроп.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "г",
                "old_price": 0
            },
            {
                "name": "Їжовик Гребінчастий Шляпки 100 г",
                "price": 750,
                "category": "Сушені гриби",
                "description": "Плодові тіла Їжовика. Максимальна концентрація активних речовин.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "г",
                "old_price": 0
            },
            {
                "name": "Їжовик Гребінчастий Порошок 50 г",
                "price": 550,
                "category": "Сушені гриби",
                "description": "Порошок Їжовика. Легко додавати в їжу та напої.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "г",
                "old_price": 0
            },
            
            # Кордицепс - різні фасування
            {
                "name": "Кордицепс Мілітаріс 50 г",
                "price": 600,
                "category": "Сушені гриби",
                "description": "Природний енергетик. Підвищує витривалість.",
                "image": "https://dikoros-ua.com/content/images/6/480x480l50nn0/korditseps-militaris-100-g-plodovye-tela-97258334464821.jpg",
                "unit": "г",
                "old_price": 0
            },
            {
                "name": "Кордицепс Мілітаріс 100 г",
                "price": 1100,
                "category": "Сушені гриби",
                "description": "Природний енергетик. Підвищує витривалість.",
                "image": "https://dikoros-ua.com/content/images/6/480x480l50nn0/korditseps-militaris-100-g-plodovye-tela-97258334464821.jpg",
                "unit": "г",
                "old_price": 0
            },
        ]

        # ========================================
        # ПІДХІД 2: РУЧНЕ НАЛАШТУВАННЯ ВАРІАНТІВ
        # Товари з складними варіантами (колір, смак, комплектація)
        # ========================================
        
        manual_variant_products = [
            # Набір для мікродозингу - різні комплектації
            {
                "name": "Набір для Мікродозингу",
                "price": 1200,  # Базова ціна (мінімальна)
                "category": "Мікродозинг",
                "description": "Готовий набір для початку практики мікродозингу. Включає капсули, інструкцію та щоденник.",
                "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp",
                "unit": "набір",
                "old_price": 1500,
                "option_names": "Тип гриба|Кількість капсул",
                "variants": json.dumps([
                    {
                        "name": "Мухомор Червоний|30 капсул",
                        "price": 1200,
                        "old_price": 1500,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    },
                    {
                        "name": "Мухомор Червоний|60 капсул",
                        "price": 2200,
                        "old_price": 2700,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    },
                    {
                        "name": "Мухомор Пантерний|30 капсул",
                        "price": 1500,
                        "old_price": 1800,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    },
                    {
                        "name": "Мухомор Пантерний|60 капсул",
                        "price": 2800,
                        "old_price": 3300,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    },
                    {
                        "name": "Псилоцибе|30 капсул",
                        "price": 1800,
                        "old_price": 2100,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    },
                    {
                        "name": "Псилоцибе|60 капсул",
                        "price": 3400,
                        "old_price": 4000,
                        "image": "https://dikoros-ua.com/content/images/37/480x480l50nn0/83401736671048.webp"
                    }
                ])
            },
            
            # Чай з грибами - різні смаки та фасування
            {
                "name": "Грибний Чай Premium",
                "price": 350,
                "category": "Чаї",
                "description": "Ексклюзивна суміш лікарських грибів з травами. Покращує імунітет та тонізує.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "пакетик",
                "old_price": 450,
                "option_names": "Смак|Фасування",
                "variants": json.dumps([
                    {
                        "name": "М'ята|20 пакетиків",
                        "price": 350,
                        "old_price": 450,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "М'ята|50 пакетиків",
                        "price": 800,
                        "old_price": 1000,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "Лимон|20 пакетиків",
                        "price": 350,
                        "old_price": 450,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "Лимон|50 пакетиків",
                        "price": 800,
                        "old_price": 1000,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "Імбир|20 пакетиків",
                        "price": 380,
                        "old_price": 480,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "Імбир|50 пакетиків",
                        "price": 850,
                        "old_price": 1050,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    }
                ])
            },
            
            # Екстракт - різні концентрації та об'єми
            {
                "name": "Екстракт Їжовика Гребінчастого",
                "price": 650,
                "category": "Екстракти",
                "description": "Концентрований екстракт Lion's Mane. Максимальна біодоступність.",
                "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp",
                "unit": "мл",
                "old_price": 800,
                "option_names": "Концентрація|Об'єм",
                "variants": json.dumps([
                    {
                        "name": "1:4|50 мл",
                        "price": 650,
                        "old_price": 800,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "1:4|100 мл",
                        "price": 1200,
                        "old_price": 1500,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "1:8|50 мл",
                        "price": 950,
                        "old_price": 1200,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    },
                    {
                        "name": "1:8|100 мл",
                        "price": 1800,
                        "old_price": 2300,
                        "image": "https://dikoros-ua.com/content/images/15/480x480l50nn0/76792348398453.webp"
                    }
                ])
            }
        ]

        # Додаємо товари з автоматичним групуванням
        print("🍄 Додаємо товари з автоматичним групуванням...")
        for p in auto_grouped_products:
            cursor.execute("""
                INSERT INTO products (name, price, category, description, image, unit, old_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (p['name'], p['price'], p['category'], p['description'], p['image'], p['unit'], p['old_price']))

        # Додаємо товари з ручними варіантами
        print("🎨 Додаємо товари з ручними варіантами...")
        for p in manual_variant_products:
            cursor.execute("""
                INSERT INTO products (name, price, category, description, image, unit, old_price, variants, option_names) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (p['name'], p['price'], p['category'], p['description'], p['image'], p['unit'], p['old_price'], p['variants'], p['option_names']))

        conn.commit()
        
        # Статистика
        total = cursor.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        with_variants = cursor.execute("SELECT COUNT(*) FROM products WHERE variants IS NOT NULL AND variants != ''").fetchone()[0]
        
        print(f"\n✅ Готово!")
        print(f"📊 Всього товарів: {total}")
        print(f"🎯 З ручними варіантами: {with_variants}")
        print(f"🔄 Для автогрупування: {total - with_variants}")
        
        conn.close()

    except Exception as e:
        print(f"❌ Помилка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    seed_database_with_variants()
