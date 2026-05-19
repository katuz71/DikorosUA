"""Admin and maintenance utility routes."""

from __future__ import annotations

import os
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from db import get_db_connection


router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/clear_products")
async def clear_products_db():
    if os.getenv("ENABLE_DANGEROUS_ADMIN_ENDPOINTS") != "1":
        raise HTTPException(status_code=404, detail="Not found")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Добавили CASCADE!
        cur.execute("TRUNCATE TABLE products RESTART IDENTITY CASCADE;")
        conn.commit()
        conn.close()
        return {"success": True, "message": "База товаров ПОЛНОСТЬЮ очищена! Теперь можно нажать фиолетовую кнопку."}
    except Exception as e:
        logger.exception("Failed to clear products database")
        raise HTTPException(status_code=500, detail="Ошибка при очистке базы")

@router.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...)):
    raise HTTPException(
        status_code=501,
        detail="CSV import is not implemented in this deployment.",
    )
