from pathlib import Path

main_path = Path("main.py")
users_path = Path("routers/users.py")

main = main_path.read_text(encoding="utf-8")

start_marker = '@app.get("/user/{phone}"'
end_marker = '@app.post("/api/auth")'

start = main.find(start_marker)
end = main.find(end_marker)

if start == -1:
    raise SystemExit("Users block start not found")
if end == -1:
    raise SystemExit("Auth block marker not found")
if end <= start:
    raise SystemExit("Invalid users block range")

users_block = main[start:end].strip()

users_block = users_block.replace("@app.get(", "@router.get(")
users_block = users_block.replace("@app.post(", "@router.post(")
users_block = users_block.replace("@app.put(", "@router.put(")
users_block = users_block.replace("@app.delete(", "@router.delete(")

users_content = '''"""Users API router."""

from __future__ import annotations

import csv
import json
from io import StringIO
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db import get_db_connection
from models.schemas import (
    AdminUserUpdate,
    BatchDeleteUsers,
    PushTokenRequest,
    UserInfoUpdate,
    UserResponse,
)
from services.auth import get_current_user_phone
from services.notifications import send_expo_push
from services.users import (
    calculate_cashback_percent,
    clean_warehouse_value,
    normalize_phone,
)


router = APIRouter()


''' + users_block + "\n"

users_path.write_text(users_content, encoding="utf-8")

new_main = main[:start].rstrip() + "\n\n" + main[end:]

old_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products"
new_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("Router import line not found")

include_marker = "app.include_router(products.router)"
include_line = "app.include_router(users.router)"

if include_line not in new_main:
    if include_marker in new_main:
        new_main = new_main.replace(include_marker, include_marker + "\n" + include_line)
    else:
        raise SystemExit("products router include marker not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: users router extracted and connected")
