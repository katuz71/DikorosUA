import os
import json
import uuid
import openai
import requests
from dotenv import load_dotenv

# 1. Загрузка конфигурации
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
API_URL = "http://localhost:8000/posts"

if not OPENAI_API_KEY:
    print("❌ Ошибка: OPENAI_API_KEY не найден в .env!")
    exit(1)

client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Твои ключевые товары
PRODUCTS_INFO = """
ID: 37775 | Мікродозінг MIX Мухомору червоного та Їжовика гребінчастого (60 капсул)
ID: 37774 | Мікродозінг Стандарт Мухомор червоний (60 капсул)
ID: 37779 | Мікродозінг Brain & Sleep Їжовик гребінчастий (60 капсул)
ID: 37772 | Мікродозінг HARD Мухомор пантерний (60 капсул)
ID: 37737 | Шоколад з мухомором (плитки по 0,5г)
ID: 37792 | Мікродозінг Head&Sleep Плодові тіла та міцелій їжовика
"""

def generate_and_post():
    print("🤖 Генерирую статью для блога 'Дико-Корисно'...")
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o", 
            messages=[
                {
                    "role": "system", 
                    "content": "Ти — провідний експерт та головний редактор блогу 'Дико-Корисно' магазину DikorosUA. Твоя мета — створювати глибокий, корисний та структурований контент УКРАЇНСЬКОЮ мовою."
                },
                {
                    "role": "user", 
                    "content": f"""Напиши захоплюючу статтю про мікродозинг для нашого блогу.
                    
                    СПИСОК ТОВАРІВ ДЛЯ ПОСИЛАНЬ:
                    {PRODUCTS_INFO}

                    ОБОВ'ЯЗКОВІ ВИМОГИ:
                    1. МОВА: Тільки українська. Тон — дружній, але професійний.
                    2. ПОСИЛАННЯ: Обов'язково інтегруй мінімум 3 товари у форматі [Назва](dikorosua://product/ID).
                    3. АКЦЕНТИ: Використовуй **жирний шрифт** для важливих висновків.
                    4. ФІНАЛ: Завершуй кожну статтю фірмовим підписом, наприклад: 'Залишайтеся здоровими разом із Дико-Корисно!'.
                    
                    Поверни СУВОРО JSON: {{"title": "...", "content": "..."}}"""
                }
            ],
            response_format={ "type": "json_object" }
        )
        
        post_data = json.loads(response.choices[0].message.content)

        # Генерация картинки
        print(f"🎨 Рисую обложку для темы: {post_data['title']}...")
        img_response = client.images.generate(
            model="dall-e-3",
            prompt=f"Aesthetic high-end photography for 'Diko-Korisno' blog. Theme: mushrooms, wellness, organic lifestyle. Professional lighting.",
            size="1024x1024",
            n=1,
        )
        # Скачиваем картинку с DALL-E и сохраняем локально (временные URL быстро умирают)
        image_url_from_dalle = img_response.data[0].url
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        os.makedirs(uploads_dir, exist_ok=True)
        ext = "png"  # DALL-E 3 возвращает PNG
        local_filename = f"image_{uuid.uuid4().hex}.{ext}"
        local_path = os.path.join(uploads_dir, local_filename)
        try:
            r = requests.get(image_url_from_dalle, timeout=30)
            r.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(r.content)
            post_data["image_url"] = f"/uploads/{local_filename}"
            print(f"📁 Изображение сохранено: {post_data['image_url']}")
        except Exception as e:
            print(f"⚠️ Не удалось скачать изображение: {e}. Сохраняем пост без обложки.")
            post_data["image_url"] = None

        # Публикация
        res = requests.post(API_URL, json=post_data)
        if res.status_code == 200:
            print("✅ ПОБЕДА: Статья для 'Дико-Корисно' успешно опубликована!")
        else:
            print(f"❌ Ошибка: {res.text}")

    except Exception as e:
        print(f"💥 Ошибка: {str(e)}")

if __name__ == "__main__":
    generate_and_post()