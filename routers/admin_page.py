"""Admin page route."""

from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter()


@router.get("/admin", response_class=HTMLResponse)
async def read_admin():
    """Admin panel with proper security headers"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    admin_path = os.path.join(base_dir, "admin.html")
    if os.path.exists(admin_path):
        with open(admin_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "<h1>admin.html not found</h1>"
    
    return HTMLResponse(
        content=content,
        headers={
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
