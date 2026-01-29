import httpx
import xml.etree.ElementTree as ET
import sqlite3
import logging
import asyncio

# Настройка
XML_URL = "https://dikoros-ua.com/content/export/bf351a5f3e215279ad2595191546196b.xml?1769635837761"
DB_NAME = "shop.db"

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER,
            image TEXT,
            description TEXT,
            category TEXT,
            external_id TEXT UNIQUE
        )
    """)
    conn.commit()
    conn.close()

async def download_xml():
    logger.info("⏳ Скачиваю XML-файл...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(XML_URL, timeout=60.0)
        if resp.status_code == 200:
            return resp.content
        else:
            logger.error(f"❌ Ошибка скачивания: {resp.status_code}")
            return None

def parse_and_save(xml_content):
    if not xml_content: return

    logger.info("📦 Разбираю структуру XML...")
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        logger.error(f"❌ Ошибка чтения XML: {e}")
        return

    # 1. Собираем категории (id -> название)
    # Структура: <categories><category id="1">Грибы</category>...</categories>
    categories = {}
    for cat in root.findall(".//category"):
        cat_id = cat.get("id")
        cat_name = cat.text
        categories[cat_id] = cat_name
    
    logger.info(f"📂 Найдено категорий: {len(categories)}")

    # 2. Собираем товары
    # Структура: <offers><offer>...</offer></offers>
    offers = root.findall(".//offer")
    logger.info(f"🔎 Найдено товаров в файле: {len(offers)}")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    new_count = 0
    update_count = 0

    for offer in offers:
        try:
            # Получаем данные
            name = offer.findtext("name") or offer.findtext("model")
            price = offer.findtext("price")
            picture = offer.findtext("picture")
            description = offer.findtext("description") or "Опис відсутній"
            cat_id = offer.findtext("categoryId")
            url = offer.findtext("url") # Используем как уникальный ID
            
            # Определяем название категории
            category_name = categories.get(cat_id, "Інше")

            if not name or not price:
                continue

            # Очистка цены
            price = int(float(price))

            # Проверяем, есть ли товар
            cursor.execute("SELECT id FROM products WHERE external_id = ?", (url,))
            exists = cursor.fetchone()

            if exists:
                # Обновляем
                cursor.execute("""
                    UPDATE products 
                    SET price=?, image=?, description=?, category=?, name=?
                    WHERE external_id=?
                """, (price, picture, description, category_name, name, url))
                update_count += 1
            else:
                # Создаем
                cursor.execute("""
                    INSERT INTO products (name, price, image, description, category, external_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (name, price, picture, description, category_name, url))
                new_count += 1
                
        except Exception as e:
            print(f"Ошибка с товаром: {e}")

    conn.commit()
    conn.close()
    
    print("-" * 30)
    print(f"✅ УСПЕХ!")
    print(f"🆕 Добавлено новых: {new_count}")
    print(f"🔄 Обновлено старых: {update_count}")
    print(f"📦 Всего в базе сейчас: {new_count + update_count}")

if __name__ == "__main__":
    init_db()
    xml_data = asyncio.run(download_xml())
    parse_and_save(xml_data)