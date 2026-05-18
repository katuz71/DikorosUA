"""Banner routes."""

from __future__ import annotations

from fastapi import APIRouter

from db import get_db_connection
from models.schemas import BannerCreate


router = APIRouter()


@router.get("/api/banners")
@router.get("/banners")
def get_banners():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM banners").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@router.post("/banners")
async def create_banner(banner: BannerCreate):
    conn = get_db_connection()
    conn.execute("INSERT INTO banners (image_url) VALUES (?)", (banner.image_url,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.delete("/banners/{id}")
async def delete_banner(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM banners WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}
