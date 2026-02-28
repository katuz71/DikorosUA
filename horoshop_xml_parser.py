# -*- coding: utf-8 -*-
"""
Парсер XML Horoshop и импорт товаров в БД.
При обновлении существующих товаров поле description не перезаписывается.
"""
import os
import json
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL")


def _text(elem, default=""):
    if elem is None:
        return default
    return (elem.text or "").strip() or default


def _find_text(parent, *tags):
    for tag in tags:
        child = parent.find(tag)
        if child is not None and (child.text or "").strip():
            return (child.text or "").strip()
        # try with namespace
        if "}" in tag:
            continue
        for c in parent:
            if c.tag.endswith("}" + tag) or c.tag == tag:
                if (c.text or "").strip():
                    return (c.text or "").strip()
                break
    return ""


def parse_horoshop_xml(xml_path: str) -> list:
    """
    Парсит XML файл (Horoshop / YML / типичные экспорты) и возвращает список словарей товаров.
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # Типичные корневые структуры: yml_catalog/shop/offers/offer, root/items/item, root/products/product, shop/offers/offer
    offers = []
    for path in ("./{*}shop/{*}offers/{*}offer", "./{*}offers/{*}offer", "./{*}items/{*}item", "./{*}products/{*}product", "./{*}offer", "./{*}item", "./{*}product"):
        offers = root.findall(path)
        if not offers:
            # без namespace
            offers = root.findall(path.replace("{*}", ""))
        if offers:
            break

    if not offers:
        # попробуем любой элемент с дочерними name/price
        for elem in root.iter():
            if elem.find("name") is not None and elem.find("price") is not None:
                offers = [elem]
                break
            n = elem.find("{*}name")
            p = elem.find("{*}price")
            if n is not None and p is not None:
                offers = [elem]
                break

    products = []
    for offer in offers:
        name = _find_text(offer, "name", "title", "product_name")
        price = _find_text(offer, "price", "price_old")
        if not name and not price:
            continue
        try:
            price_f = float(price.replace(",", ".").replace(" ", "")) if price else 0.0
        except ValueError:
            price_f = 0.0
        old_price = _find_text(offer, "old_price", "price_old", "compare_at_price")
        try:
            old_price_f = float(old_price.replace(",", ".").replace(" ", "")) if old_price else None
        except ValueError:
            old_price_f = None
        description = _find_text(offer, "description", "desc", "full_description")
        category = _find_text(offer, "category", "category_name", "type")
        image = _find_text(offer, "picture", "image", "img", "photo")
        url = _find_text(offer, "url", "link", "id")
        unit = _find_text(offer, "unit", "unit_name") or "шт"

        # несколько картинок
        images_elem = offer.find("images") or offer.find("pictures") or offer.find("gallery")
        images_list = []
        if image:
            images_list.append(image)
        if images_elem is not None:
            for img in images_elem.findall("image") or images_elem.findall("picture") or images_elem.findall("img") or []:
                u = (img.text or "").strip() or img.get("url") or img.get("src")
                if u and u not in images_list:
                    images_list.append(u)
        images_str = json.dumps(images_list) if images_list else None
        if not image and images_list:
            image = images_list[0]

        external_id = url or (offer.get("id") or "").strip() or None
        if external_id:
            external_id = str(external_id).strip()

        products.append({
            "name": name or "Без названия",
            "price": price_f,
            "old_price": old_price_f,
            "category": category or None,
            "description": description or None,
            "image": image or None,
            "images": images_str,
            "unit": unit,
            "external_id": external_id,
            "usage": _find_text(offer, "usage", "application") or None,
            "composition": _find_text(offer, "composition", "ingredients") or None,
            "delivery_info": _find_text(offer, "delivery_info", "delivery") or None,
            "return_info": _find_text(offer, "return_info", "returns") or None,
            "variants": None,
            "option_names": None,
        })
    return products


def _get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required for import_products_to_db")
    return psycopg2.connect(DATABASE_URL)


def import_products_to_db(products: list) -> dict:
    """
    Импортирует товары в БД: новые — INSERT, существующие (по external_id) — UPDATE.
    При обновлении существующих товаров поле description НЕ перезаписывается (остаётся из БД).
    После импорта синхронизирует категории из товаров и выводит в лог «Synced N categories from products».
    """
    conn = _get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    imported = 0
    updated = 0

    for p in products:
        external_id = p.get("external_id")
        name = p.get("name") or ""
        price = p.get("price") or 0
        category = p.get("category")
        image = p.get("image")
        images = p.get("images")
        old_price = p.get("old_price")
        unit = p.get("unit") or "шт"
        description = p.get("description")
        usage = p.get("usage")
        composition = p.get("composition")
        delivery_info = p.get("delivery_info")
        return_info = p.get("return_info")
        variants = p.get("variants")
        option_names = p.get("option_names")
        if isinstance(variants, (list, dict)):
            variants = json.dumps(variants)
        if variants is None:
            variants = None

        if external_id:
            cur.execute(
                "SELECT id, description FROM products WHERE external_id = %s",
                (external_id,)
            )
            row = cur.fetchone()
        else:
            row = None

        if row:
            # Обновление существующего товара: name и description не перезаписываем (оставляем из БД)
            cur.execute("""
                UPDATE products SET
                    price = %s, category = %s, image = %s, images = %s,
                    usage = %s, composition = %s, old_price = %s, unit = %s,
                    variants = %s, option_names = %s, delivery_info = %s, return_info = %s
                WHERE external_id = %s
            """, (
                price, category, image, images,
                usage, composition, old_price, unit,
                variants, option_names, delivery_info, return_info,
                external_id
            ))
            updated += 1
        else:
            # Новый товар: INSERT с description
            cur.execute("""
                INSERT INTO products (
                    name, price, category, image, images, description,
                    usage, composition, old_price, unit, variants, option_names,
                    delivery_info, return_info, external_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                name, price, category, image, images, description,
                usage, composition, old_price, unit, variants, option_names,
                delivery_info, return_info, external_id
            ))
            imported += 1

    conn.commit()

    # Синхронизация категорий из товаров (уникальные category -> таблица categories)
    cur.execute("""
        INSERT INTO categories (name)
        SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''
        ON CONFLICT (name) DO NOTHING
    """)
    cur.execute("SELECT COUNT(DISTINCT category) AS n FROM products WHERE category IS NOT NULL AND category != ''")
    cat_count = cur.fetchone()["n"]
    print(f"Synced {cat_count} categories from products.")

    conn.commit()
    cur.close()
    conn.close()

    return {"total": len(products), "imported": imported, "updated": updated}
