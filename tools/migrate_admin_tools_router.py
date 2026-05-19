from pathlib import Path

main_path = Path("main.py")
router_path = Path("routers/admin_tools.py")

main = main_path.read_text(encoding="utf-8")

# 1) Extract clear_products block
clear_start = main.find('@app.get("/api/clear_products")')
middleware_marker = "app.add_middleware("

if clear_start == -1:
    raise SystemExit("clear_products block start not found")

clear_end = main.find(middleware_marker, clear_start)
if clear_end == -1:
    raise SystemExit("middleware marker not found after clear_products")

clear_block = main[clear_start:clear_end].strip()

# 2) Extract upload_csv block only
upload_start = main.find('@app.post("/upload_csv")')
admin_marker = '@app.get("/admin"'

if upload_start == -1:
    raise SystemExit("upload_csv block start not found")

upload_end = main.find(admin_marker, upload_start)
if upload_end == -1:
    raise SystemExit("admin marker not found after upload_csv")

upload_block = main[upload_start:upload_end].strip()

# 3) Remove extracted blocks from main.py
new_main = main[:clear_start].rstrip() + "\n" + main[clear_end:upload_start].rstrip() + "\n\n" + main[upload_end:]

router_block = clear_block + "\n\n" + upload_block
router_block = router_block.replace("@app.get(", "@router.get(")
router_block = router_block.replace("@app.post(", "@router.post(")

content = '''"""Admin and maintenance utility routes."""

from __future__ import annotations

import os
import traceback

from fastapi import APIRouter, File, HTTPException, UploadFile

from db import get_db_connection


router = APIRouter()


''' + router_block + "\n"

router_path.write_text(content, encoding="utf-8")

old_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth"
new_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth, admin_tools"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("Router import line not found")

include_marker = "app.include_router(auth.router)"
include_line = "app.include_router(admin_tools.router)"

if include_line not in new_main:
    if include_marker in new_main:
        new_main = new_main.replace(include_marker, include_marker + "\n" + include_line)
    else:
        raise SystemExit("auth router include marker not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: admin tools router extracted and connected")
