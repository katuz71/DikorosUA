"""
Скрипт перегенерации протухших картинок для статей блога (posts с image_url содержащим oaidalle).
Скачивает изображения от DALL-E 3, сохраняет в uploads/, обновляет image_url в PostgreSQL.
"""
import os
import uuid
import openai
import psycopg2
import requests
from dotenv import load_dotenv

# Загрузка переменных окружения из .env в корне проекта
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("POSTGRES_USER", "postgres")
    DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
    DB_HOST = os.getenv("POSTGRES_HOST", "db")
    DB_NAME = os.getenv("POSTGRES_DB", "postgres")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

if not OPENAI_API_KEY:
    print("❌ Ошибка: OPENAI_API_KEY не найден в .env!")
    exit(1)


def main():
    print("🔧 fix_old_images: поиск постов с протухшими картинками (oaidalle)...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute(
        "SELECT id, title, image_url FROM posts WHERE image_url LIKE %s",
        ("%oaidalle%",),
    )
    rows = cur.fetchall()
    if not rows:
        print("✅ Постов с битыми ссылками не найдено.")
        cur.close()
        conn.close()
        return

    print(f"📋 Найдено постов с протухшими картинками: {len(rows)}\n")
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
    os.makedirs(uploads_dir, exist_ok=True)

    for post_id, title, old_url in rows:
        title_display = (title or "")[:60] + ("..." if len(title or "") > 60 else "")
        print(f"📄 Пост id={post_id}: {title_display}")

        try:
            prompt = (
                f"Photorealistic image for an article about: {title or 'nature and wellness'}. "
                "Nature, organic, high quality, no text."
            )
            img_response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                n=1,
            )
            image_url_from_dalle = img_response.data[0].url

            ext = "png"
            local_filename = f"image_{uuid.uuid4().hex}.{ext}"
            local_path = os.path.join(uploads_dir, local_filename)

            r = requests.get(image_url_from_dalle, timeout=30)
            r.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(r.content)

            new_image_url = f"/uploads/{local_filename}"
            cur.execute("UPDATE posts SET image_url = %s WHERE id = %s", (new_image_url, post_id))
            conn.commit()
            print(f"   ✅ Картинка сохранена: {new_image_url}\n")
        except Exception as e:
            print(f"   ❌ Ошибка: {e}\n")
            conn.rollback()

    cur.close()
    conn.close()
    print("🏁 Готово.")


if __name__ == "__main__":
    main()
