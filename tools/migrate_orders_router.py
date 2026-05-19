from pathlib import Path

main_path = Path("main.py")
orders_path = Path("routers/orders.py")

main = main_path.read_text(encoding="utf-8")

start_marker = "# 2. ЗАКАЗЫ"
end_marker = "# 5. ПОЛЬЗОВАТЕЛИ"

start = main.find(start_marker)
end = main.find(end_marker)

if start == -1:
    raise SystemExit("Orders block start not found")
if end == -1:
    raise SystemExit("Users block marker not found")
if end <= start:
    raise SystemExit("Invalid orders block range")

orders_block = main[start:end].strip()

orders_block = orders_block.replace("@app.get(", "@router.get(")
orders_block = orders_block.replace("@app.post(", "@router.post(")
orders_block = orders_block.replace("@app.put(", "@router.put(")
orders_block = orders_block.replace("@app.delete(", "@router.delete(")

orders_content = '''"""Orders API router."""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from io import StringIO

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse

from db import DATABASE_URL, get_db_connection
from models.schemas import BatchDelete, OrderRequest, OrderStatusUpdate
from services.notifications import send_expo_push
from services.onebox_api import OneBoxDbSession, Product, create_onebox_order
from services.users import calculate_cashback_percent, clean_warehouse_value, normalize_phone


router = APIRouter()


''' + orders_block + "\n"

orders_path.write_text(orders_content, encoding="utf-8")

new_main = main[:start].rstrip() + "\n\n" + main[end:]
old_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts"
new_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("Router import line not found")

include_marker = "app.include_router(posts.router)"
include_line = "app.include_router(orders.router)"

if include_line not in new_main:
    if include_marker in new_main:
        new_main = new_main.replace(include_marker, include_marker + "\n" + include_line)
    else:
        raise SystemExit("posts router include marker not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: orders router extracted and connected")
