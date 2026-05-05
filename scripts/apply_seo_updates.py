import psycopg2
import re

DB_URL = "postgresql://postgres:postgres@postgres_db:5432/app_db"

def clean_text(text):
    if not text: return ""
    # Убираем всё, кроме букв и цифр, переводим в нижний регистр
    text = re.sub(r'[^\w\s]', '', text.lower())
    # Удаляем стоп-слова, которые мешают поиску
    for word in ['мікродозінг', 'микродозинг', '60 капсул', 'капсул', 'та']:
        text = text.replace(word, '')
    return " ".join(text.split())

def fix_blog_links():
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()

        print(f"--- РЕВИЗИЯ ОБНОВЛЕННОЙ БАЗЫ ---")
        cur.execute("SELECT id, name FROM products")
        products = cur.fetchall()
        print(f"Всего живых товаров в базе: {len(products)}")
        
        # Карта товаров для поиска
        product_map = {clean_text(p[1]): p[0] for p in products}

        cur.execute("SELECT id, content FROM posts")
        posts = cur.fetchall()

        updated_count = 0

        for post_id, post_content in posts:
            if not post_content: continue
            
            # Ищем паттерн [Текст](dikorosua://product/ID)
            pattern = r'\[([^\]]+)\]\(dikorosua://product/(\d+)\)'
            
            def replace_id(match):
                link_text = match.group(1)
                old_id = match.group(2)
                clean_link = clean_text(link_text)
                
                new_id = None

                # 1. Спец-правило для MIX (если в названии ссылки есть Мухомор и Ежовик)
                if 'mix' in clean_link or 'мікс' in clean_link or ('мухомор' in clean_link and 'їжовик' in clean_link):
                    for name, p_id in product_map.items():
                        if 'mix' in name or 'мікс' in name or ('мухомор' in name and 'їжовик' in name):
                            new_id = p_id
                            break
                
                # 2. Спец-правило для Шоколада
                if 'шоколад' in clean_link and not new_id:
                    for name, p_id in product_map.items():
                        if 'шоколад' in name:
                            new_id = p_id
                            break

                # 3. Поиск по очищенному названию
                if not new_id:
                    new_id = product_map.get(clean_link)
                
                # 4. Поиск по частичному вхождению
                if not new_id:
                    for prod_name, p_id in product_map.items():
                        if clean_link in prod_name or prod_name in clean_link:
                            new_id = p_id
                            break
                
                if new_id:
                    print(f"  Статья {post_id}: ✅ Связали '{link_text}' с новым ID {new_id}")
                    return f"[{link_text}](dikorosua://product/{new_id})"
                else:
                    print(f"  Статья {post_id}: ❌ Товар '{link_text}' не найден в новой базе")
                    return match.group(0)

            new_content = re.sub(pattern, replace_id, post_content)
            
            if new_content != post_content:
                cur.execute("UPDATE posts SET content = %s WHERE id = %s", (new_content, post_id))
                updated_count += 1

        conn.commit()
        print(f"\n✅ Готово! Статей перепривязано: {updated_count}")
        cur.close()
    except Exception as e:
        print(f"Ошибка: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    fix_blog_links()
