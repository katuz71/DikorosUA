"""Catalog sync routes."""

from __future__ import annotations

import os
import traceback

import httpx
from fastapi import APIRouter, HTTPException, Request

from db import get_db_connection


router = APIRouter()


@router.post("/api/sync/catalog")
async def sync_catalog_horoshop(request: Request):
    import httpx, traceback, os
    from fastapi import HTTPException
    
    domain = os.getenv("HOROSHOP_DOMAIN")
    login = os.getenv("HOROSHOP_LOGIN")
    password = os.getenv("HOROSHOP_PASSWORD")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        async with httpx.AsyncClient(timeout=120.0) as client:
            # 1. Авторизація (отримуємо токен)
            r_auth = await client.post(f"https://{domain}/api/auth/", json={"login": login, "password": password})
            auth_data = r_auth.json()
            
            token = auth_data.get("response", {}).get("token") or auth_data.get("token")
            if not token: 
                raise HTTPException(status_code=400, detail=f"Помилка авторизації: {auth_data}")
            
            # 2. Експорт товарів строго за документацією (POST-запит, токен у тілі)
            payload = {
                "token": token,
                "limit": 500  # Беремо до 500 товарів за один раз
            }
            
            r_export = await client.post(f"https://{domain}/api/catalog/export/", json=payload)
            export_data = r_export.json()
            
            if export_data.get("status") != "OK":
                raise HTTPException(status_code=400, detail=f"Хорошоп повернув помилку: {export_data}")
            
            products_list = export_data.get("response", {}).get("products", [])
            
            if not products_list:
                raise HTTPException(status_code=400, detail="API повернув пустий список товарів")
            
            count = 0
            for item in products_list:
                # Артикул
                sku = str(item.get("article") or item.get("parent_article") or "")
                if not sku: 
                    continue
                
                # Вариации
                parent_sku = str(item.get("parent_article") or "")
                mod_title_obj = item.get("mod_title") or {}
                variant_name = str(mod_title_obj.get("ua") or mod_title_obj.get("ru") or "")
                
                # Назва (пріоритет українській мові)
                title_obj = item.get("title") or {}
                title = title_obj.get("ua") or title_obj.get("ru") or "Без назви"
                
                # Опис
                desc_obj = item.get("description") or {}
                description = desc_obj.get("ua") or desc_obj.get("ru") or ""
                
                # Категорія
                parent_obj = item.get("parent") or {}
                category = parent_obj.get("value") or "Загальне"
                
                # Ціни
                try:
                    price = float(item.get("price") or 0)
                except:
                    price = 0.0

                try:
                    old_price = float(item.get("old_price") or 0)
                except:
                    old_price = 0.0
                    
                # Наявність
                status = "available"
                presence_obj = item.get("presence") or {}
                if presence_obj.get("id") == 2:  # 2 - "Немає в наявності" згідно з документацією
                    status = "out_of_stock"
                    
                # Картинки (забираємо першу для image, і всі для images)
                img_list = item.get("images") or []
                img = img_list[0] if img_list else ""
                images_str = ",".join(img_list) if img_list else ""

                # --- НОВАЯ ЛОГИКА ПАРСИНГА ИКОНОК ХОРОШОПА ---
                
                # 1. Извлекаем все тексты из массива icons (там лежат Хит, Новинка и т.д.)
                icons_data = item.get("icons", [])
                icon_texts = []
                for icon in icons_data:
                    val_obj = icon.get("value", {})
                    # Собираем значения (ua, ru, en) в один список для поиска
                    if isinstance(val_obj, dict):
                        icon_texts.extend([str(v).lower() for v in val_obj.values()])

                # 2. Определяем статусы (системные флаги + поиск по ключевым словам в иконках)
                is_hit = bool(
                    item.get("hit") == 1 or 
                    any("хит" in t or "хіт" in t for t in icon_texts)
                )

                is_new = bool(
                    item.get("new") == 1 or 
                    any("новинка" in t or "new" in t for t in icon_texts)
                )

                is_promotion = bool(
                    item.get("action") == 1 or 
                    (old_price > 0 and old_price > price) or
                    any("акці" in t or "распродажа" in t or "скидка" in t for t in icon_texts)
                )
                # ---------------------------------------------
                
                # Запис або оновлення у БД (за артикулом)
                cur.execute("SELECT id FROM products WHERE sku = ?", (sku,))
                exists = cur.fetchone()
                if exists:
                    p_id = exists['id'] if isinstance(exists, dict) else exists[0]
                    cur.execute("""
                        UPDATE products SET 
                            name = ?, price = ?, category = ?, status = ?, 
                            description = ?, image = ?, images = ?,
                            parent_sku = ?, variant_name = ?,
                            is_hit = ?, is_promotion = ?, is_new = ?, old_price = ?
                        WHERE id = ?
                    """, (title, price, category, status, description, img, images_str, parent_sku, variant_name, is_hit, is_promotion, is_new, old_price, p_id))
                else:
                    cur.execute("""
                        INSERT INTO products (sku, name, price, category, status, description, image, images, parent_sku, variant_name, is_hit, is_promotion, is_new, old_price)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (sku, title, price, category, status, description, img, images_str, parent_sku, variant_name, is_hit, is_promotion, is_new, old_price))
                count += 1
                
        conn.commit()
        conn.close()
        return {"success": True, "count": count, "message": f"Синхронізовано товарів: {count}"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"❌ Horoshop Sync API Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Внутрішня помилка API: {str(e)}")
