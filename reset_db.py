#!/usr/bin/env python3
"""
Скрипт для сброса базы данных shop.db
Очищает все старые данные VitaStore и создает базовые категории для Dikoros UA
"""

import sqlite3
import os
from datetime import datetime

def reset_database():
    """Полностью сбрасывает базу данных и создает базовые категории"""
    
    db_path = 'shop.db'
    
    # Проверяем существование файла базы данных
    if not os.path.exists(db_path):
        print(f"❌ Файл базы данных {db_path} не найден!")
        return False
    
    try:
        # Подключаемся к базе данных
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Подключено к базе данных shop.db")
        
        # 1. Очищаем таблицу products
        cursor.execute("DELETE FROM products")
        deleted_products = cursor.rowcount
        print(f"🗑️  Удалено записей из products: {deleted_products}")
        
        # 2. Очищаем таблицу categories
        cursor.execute("DELETE FROM categories")
        deleted_categories = cursor.rowcount
        print(f"🗑️  Удалено записей из categories: {deleted_categories}")
        
        # 3. Сбрасываем счетчики автоинкремента
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories')")
        print("🔄 Сброшены счетчики автоинкремента")
        
        # 4. Создаем базовые категории для Dikoros UA
        categories_data = [
            ("Сушені гриби",),
            ("Мікродозинг",)
        ]
        
        cursor.executemany("""
            INSERT INTO categories (name)
            VALUES (?)
        """, categories_data)
        
        created_categories = cursor.rowcount
        print(f"✅ Создано категорий: {created_categories}")
        
        # 5. Проверяем результат
        cursor.execute("SELECT id, name FROM categories ORDER BY id")
        categories = cursor.fetchall()
        
        print("\n📋 Созданные категории:")
        for cat in categories:
            print(f"   ID: {cat[0]} | {cat[1]}")
        
        # 6. Проверяем пустую таблицу products
        cursor.execute("SELECT COUNT(*) FROM products")
        products_count = cursor.fetchone()[0]
        print(f"\n📦 Товаров в базе: {products_count} (ожидается 0)")
        
        # Сохраняем изменения
        conn.commit()
        
        # 7. Добавляем запись о сбросе в специальную таблицу (если существует)
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS db_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("""
                INSERT INTO db_logs (action, description)
                VALUES (?, ?)
            """, ("database_reset", f"База данных сброшена и подготовлена для Dikoros UA. Создано {created_categories} категорий."))
            
            conn.commit()
            print("📝 Запись о сбросе добавлена в журнал")
        except sqlite3.Error as e:
            print(f"⚠️  Не удалось создать запись в журнале: {e}")
        
        print(f"\n🎉 База данных успешно сброшена и подготовлена!")
        print(f"⏰ Время выполнения: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Ошибка работы с базой данных: {e}")
        return False
        
    except Exception as e:
        print(f"❌ Непредвиденная ошибка: {e}")
        return False
        
    finally:
        # Закрываем соединение
        if 'conn' in locals():
            conn.close()
            print("🔒 Соединение с базой данных закрыто")

def main():
    """Главная функция"""
    print("=" * 60)
    print("🔄 СКРИПТ СБРОСА БАЗЫ ДАННЫХ DIKOROS UA")
    print("=" * 60)
    print("⚠️  ВНИМАНИЕ: Все существующие данные будут УДАЛЕНЫ!")
    print("📋 Операции:")
    print("   1. Полная очистка таблицы products")
    print("   2. Полная очистка таблицы categories") 
    print("   3. Сброс счетчиков ID")
    print("   4. Создание базовых категорий")
    print("   5. Оставление таблицы products пустой")
    print("=" * 60)
    
    # Подтверждение пользователя
    user_input = input("\n❓ Вы уверены, что хотите продолжить? (yes/no): ").strip().lower()
    
    if user_input not in ['yes', 'y', 'да', 'д']:
        print("❌ Операция отменена пользователем")
        return
    
    print("\n🚀 Начинаю сброс базы данных...")
    
    success = reset_database()
    
    if success:
        print("\n✅ Операция завершена успешно!")
        print("📝 База готова для наполнения через админ-панель")
    else:
        print("\n❌ Произошла ошибка при сбросе базы данных")
    
    print("=" * 60)

if __name__ == "__main__":
    main()
