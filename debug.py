import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Ваши настройки из .env
DOMAIN = os.getenv("ONEBOX_DOMAIN", "dikoros.1b.app").replace("https://", "").strip("/")
LOGIN = os.getenv("ONEBOX_LOGIN")
PASSWORD = os.getenv("ONEBOX_REST_PASSWORD")

print(f"🕵️ ПРОВЕРКА СВЯЗИ С ONEBOX")
print(f"👤 Логин: {LOGIN}")
print(f"🔑 Пароль: {PASSWORD[:5]}... (скрыт)")
print(f"🌐 Домен: {DOMAIN}")
print("-" * 30)

async def test_connection():
    # Список адресов для проверки
    urls = [
        f"https://{DOMAIN}/api/product/list",
        f"https://{DOMAIN}/api/rest/product/list",
        f"https://{DOMAIN}/api/v2/product/get"
    ]

    async with httpx.AsyncClient() as client:
        for url in urls:
            print(f"\n🚀 Пробуем адрес: {url}")
            try:
                payload = {"login": LOGIN, "password": PASSWORD, "limit": 1}
                response = await client.post(url, json=payload, timeout=10)
                
                print(f"STATUS CODE: {response.status_code}")
                print(f"ОТВЕТ СЕРВЕРА: {response.text[:300]}") # Первые 300 символов
                
                if response.status_code == 200 and not response.text.strip().startswith("<"):
                    print("✅ ЭТОТ АДРЕС РАБОТАЕТ!")
                else:
                    print("❌ ОШИБКА")
                    
            except Exception as e:
                print(f"🔥 Сбой соединения: {e}")

def check_db():
    conn = sqlite3.connect('shop.db')
    cursor = conn.cursor()
    
    print("\n--- Проверка таблицы 'products' ---")
    print("Columns in 'products' table:")
    try:
        cursor.execute("PRAGMA table_info(products)")
        columns = cursor.fetchall()
        if columns:
            for col in columns:
                print(col)
        else:
            print("Table 'products' not found or has no columns.")
    except sqlite3.OperationalError as e:
        print(f"Error checking table info: {e}")

    conn.close()

if __name__ == "__main__":
    asyncio.run(test_connection())
    check_db()