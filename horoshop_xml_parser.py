import requests
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
import sqlite3
import re
from collections import defaultdict

def parse_horoshop_xml(xml_path: str) -> List[Dict[str, Any]]:
    """
    Парсит XML файл формата horoshop с group_id для группировки вариантов.
    """
    try:
        # Читаем XML файл
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        # Загружаем категории
        categories_map = {}
        for cat in root.findall('.//category'):
            cat_id = cat.get('id')
            cat_name = cat.text.strip() if cat.text else ''
            if cat_id:
                categories_map[cat_id] = cat_name
        
        print(f"📁 Найдено категорий: {len(categories_map)}")
        
        # Группируем товары по group_id
        products_dict = defaultdict(lambda: {
            'variants': [],
            'images': set(),
            'category': None,
            'description': None,
            'usage': None,
            'composition': None,
            'external_ids': [],
            'vendor': None,
            'url': None
        })
        
        # Находим все товары
        offers = root.findall('.//offer')
        print(f"📦 Найдено товаров в XML: {len(offers)}")
        
        for offer in offers:
            try:
                # Базовые поля
                offer_id = offer.get('id', '')
                group_id = offer.get('group_id', '')
                available = offer.get('available', 'true')
                
                # Пропускаем недоступные товары
                if available.lower() != 'true':
                    continue
                
                # Извлекаем данные
                name_elem = offer.find('name')
                name = name_elem.text.strip() if name_elem is not None and name_elem.text else ''
                
                price_elem = offer.find('price')
                price_text = price_elem.text.strip() if price_elem is not None and price_elem.text else '0'
                
                category_id = offer.findtext('categoryId', '').strip()
                category = categories_map.get(category_id, '')
                
                url = offer.findtext('url', '').strip()
                vendor = offer.findtext('vendor', '').strip()
                vendor_code = offer.findtext('vendorCode', '').strip()
                
                # Извлекаем все изображения
                pictures = []
                for pic in offer.findall('picture'):
                    if pic.text:
                        pictures.append(pic.text.strip())
                
                # Описание (может содержать CDATA)
                desc_elem = offer.find('description')
                description = ''
                if desc_elem is not None:
                    description = desc_elem.text.strip() if desc_elem.text else ''
                    # Убираем HTML теги для чистого текста
                    description = re.sub(r'<[^>]+>', '', description)
                    description = description.replace('&nbsp;', ' ')
                    description = description.replace('&mdash;', '—')
                    description = description.replace('&ndash;', '–')
                    description = description.replace('&rsquo;', "'")
                    # Оставляем только первые 500 символов для краткости
                    if len(description) > 500:
                        description = description[:500] + '...'
                
                # Парсим цену
                try:
                    price = float(re.sub(r'[^\d.]', '', price_text))
                except:
                    price = 0
                
                if not name or price <= 0:
                    continue
                
                # Извлекаем размер/вес из названия
                variant_info = extract_variant_from_name(name)
                
                # Нормализуем название (убираем размер)
                base_name = normalize_name_remove_variant(name)
                
                # Используем group_id для группировки, если он есть
                group_key = group_id if group_id else base_name
                
                # Добавляем вариант в группу
                product_group = products_dict[group_key]
                product_group['variants'].append({
                    'size': variant_info,
                    'price': price,
                    'vendor_code': vendor_code
                })
                product_group['images'].update(pictures)
                product_group['external_ids'].append(offer_id)
                
                # Сохраняем общие данные (берем из первого варианта)
                if not product_group['category']:
                    product_group['category'] = category
                if not product_group['description']:
                    product_group['description'] = description
                if not product_group['vendor']:
                    product_group['vendor'] = vendor
                if not product_group['url']:
                    product_group['url'] = url
                
                # Сохраняем базовое название (без размера)
                if 'base_name' not in product_group:
                    product_group['base_name'] = base_name
                    
            except Exception as e:
                print(f"⚠️ Ошибка парсинга товара {offer.get('id')}: {e}")
                continue
        
        # Преобразуем в список товаров
        result = []
        for group_key, data in products_dict.items():
            # Сортируем варианты по цене
            variants = sorted(data['variants'], key=lambda x: x['price'])
            
            # Минимальная цена
            min_price = min(v['price'] for v in variants) if variants else 0
            
            # Преобразуем set в список для JSON
            images = list(data['images'])
            
            # Формируем option_names (названия характеристик)
            option_names = "Фасування"  # По умолчанию для весовых товаров
            
            result.append({
                'name': data.get('base_name', 'Товар'),
                'price': min_price,
                'category': data['category'],
                'image': images[0] if images else '',
                'images': ', '.join(images),
                'description': data['description'],
                'usage': None,  # В этом XML нет отдельного поля usage
                'composition': None,  # В этом XML нет отдельного поля composition
                'variants': variants,
                'option_names': option_names,
                'external_id': ', '.join(data['external_ids']) if data['external_ids'] else None,
                'vendor': data['vendor'],
                'url': data['url']
            })
        
        print(f"✅ Сгруппировано товаров: {len(result)}")
        return result
        
    except Exception as e:
        print(f"❌ Ошибка загрузки XML: {e}")
        import traceback
        traceback.print_exc()
        raise

def extract_variant_from_name(name: str) -> str:
    """
    Извлекает размер/вес из названия товара.
    Например: "Калина червона (Viburnum opulus) сушена - 100 грам" -> "100 грам"
    """
    # Ищем паттерн типа "100 грам", "250 мл", "1 кг"
    patterns = [
        r'(\d+\s*(?:грам|мл|кг|л|шт|г|ml|mg))',  # 100 грам, 250 мл
        r'(\d+\s*(?:гр|gr))',  # 100 гр
        r'-\s*(\d+\s*[а-яА-Яa-zA-Z]+)',  # - 100 грам (с дефисом)
    ]
    
    for pattern in patterns:
        match = re.search(pattern, name, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    return "Стандарт"

def normalize_name_remove_variant(name: str) -> str:
    """
    Убирает размер/вес из названия для получения базового названия.
    Например: "Калина червона (Viburnum opulus) сушена - 100 грам" -> "Калина червона (Viburnum opulus) сушена"
    """
    # Убираем паттерны типа "- 100 грам", "- 250 мл"
    name = re.sub(r'-\s*\d+\s*(?:грам|мл|кг|л|шт|г|гр|ml|mg|gr)', '', name, flags=re.IGNORECASE)
    
    # Убираем оставшиеся дефисы в конце
    name = name.rstrip(' -').strip()
    
    return name

def import_products_to_db(products: List[Dict[str, Any]], db_path: str = 'shop.db'):
    """
    Импортирует товары в базу данных с поддержкой вариантов.
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    imported = 0
    updated = 0
    
    for product in products:
        try:
            # Сериализуем варианты в JSON
            import json
            variants_json = json.dumps(product.get('variants', []), ensure_ascii=False)
            
            # Проверяем существование товара по external_id или названию
            existing = None
            if product.get('external_id'):
                # Пробуем найти по первому external_id
                first_ext_id = product['external_id'].split(',')[0].strip()
                existing = cur.execute(
                    "SELECT id FROM products WHERE external_id LIKE ?",
                    (f"%{first_ext_id}%",)
                ).fetchone()
            
            if not existing:
                # Пробуем найти по названию
                existing = cur.execute(
                    "SELECT id FROM products WHERE name = ?",
                    (product['name'],)
                ).fetchone()
            
            if existing:
                # Обновляем существующий
                cur.execute("""
                    UPDATE products 
                    SET price=?, category=?, image=?, images=?, 
                        description=?, usage=?, composition=?, 
                        variants=?, external_id=?, option_names=?
                    WHERE id=?
                """, (
                    product['price'],
                    product['category'],
                    product['image'],
                    product['images'],
                    product['description'],
                    product['usage'],
                    product['composition'],
                    variants_json,
                    product.get('external_id'),
                    product.get('option_names'),
                    existing[0]
                ))
                updated += 1
            else:
                # Создаем новый
                cur.execute("""
                    INSERT INTO products 
                    (name, price, category, image, images, description, 
                     usage, composition, variants, unit, external_id, option_names)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    product['name'],
                    product['price'],
                    product['category'],
                    product['image'],
                    product['images'],
                    product['description'],
                    product['usage'],
                    product['composition'],
                    variants_json,
                    'шт',
                    product.get('external_id'),
                    product.get('option_names')
                ))
                imported += 1
                
        except Exception as e:
            print(f"⚠️ Ошибка импорта товара '{product.get('name')}': {e}")
            import traceback
            traceback.print_exc()
            continue
    
    conn.commit()
    conn.close()
    
    return {
        'imported': imported,
        'updated': updated,
        'total': imported + updated
    }

# Пример использования:
if __name__ == "__main__":
    # Тестовый XML файл
    xml_file = "/mnt/user-data/uploads/horoshop.xml"
    
    # Парсим XML
    products = parse_horoshop_xml(xml_file)
    
    # Показываем примеры
    print("\n" + "="*60)
    print("ПРИМЕРЫ СГРУППИРОВАННЫХ ТОВАРОВ:")
    print("="*60)
    
    for i, product in enumerate(products[:3], 1):
        print(f"\n{i}. {product['name']}")
        print(f"   Категория: {product['category']}")
        print(f"   Цена от: {product['price']} ₴")
        print(f"   Варианты:")
        for variant in product['variants']:
            print(f"      - {variant['size']}: {variant['price']} ₴")
        print(f"   Изображений: {len(product['images'].split(',')) if product['images'] else 0}")
    
    print("\n" + "="*60)
    
    # Импортируем в БД
    result = import_products_to_db(products)
    
    print(f"""
    📊 Результаты импорта:
    ✅ Новых товаров: {result['imported']}
    🔄 Обновлено: {result['updated']}
    📦 Всего обработано: {result['total']}
    """)