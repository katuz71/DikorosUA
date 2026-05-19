from pathlib import Path

main_path = Path("main.py")
sync_path = Path("routers/sync.py")

main = main_path.read_text(encoding="utf-8")

start_marker = '@app.post("/api/sync/catalog")'
start = main.find(start_marker)

if start == -1:
    raise SystemExit("sync catalog endpoint not found")

# endpoint сейчас последний в main.py
sync_block = main[start:].strip()

sync_block = sync_block.replace("@app.post(", "@router.post(")

content = '''"""Catalog sync routes."""

from __future__ import annotations

import os
import traceback

import httpx
from fastapi import APIRouter, HTTPException, Request

from db import get_db_connection


router = APIRouter()


''' + sync_block + "\n"

sync_path.write_text(content, encoding="utf-8")

new_main = main[:start].rstrip() + "\n"

old_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth, admin_tools"
new_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth, admin_tools, sync"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("Router import line not found")

include_marker = "app.include_router(admin_tools.router)"
include_line = "app.include_router(sync.router)"

if include_line not in new_main:
    if include_marker in new_main:
        new_main = new_main.replace(include_marker, include_marker + "\n" + include_line)
    else:
        raise SystemExit("admin_tools router include marker not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: sync router extracted and connected")
