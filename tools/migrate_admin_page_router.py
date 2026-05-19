from pathlib import Path

main_path = Path("main.py")
router_path = Path("routers/admin_page.py")

main = main_path.read_text(encoding="utf-8")

start_marker = '@app.get("/admin", response_class=HTMLResponse)'
start = main.find(start_marker)

if start == -1:
    raise SystemExit("admin endpoint not found")

# endpoint последний оставшийся route, но после него может не быть route.
# Берём до конца файла.
admin_block = main[start:].strip()

admin_block = admin_block.replace("@app.get(", "@router.get(")
admin_block = admin_block.replace("content=content,", "content=content,")

content = '''"""Admin page route."""

from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter()


''' + admin_block + "\n"

# Удаляем fallback на ADMIN_HTML_CONTENT: admin.html есть в репозитории.
content = content.replace(
'''    else:
        content = ADMIN_HTML_CONTENT
    ''',
'''    else:
        content = "<h1>admin.html not found</h1>"
    '''
)

router_path.write_text(content, encoding="utf-8")

new_main = main[:start].rstrip() + "\n"

old_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth, admin_tools, sync"
new_import = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat, posts, orders, products, users, auth, admin_tools, sync, admin_page"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("Router import line not found")

include_marker = "app.include_router(sync.router)"
include_line = "app.include_router(admin_page.router)"

if include_line not in new_main:
    if include_marker in new_main:
        new_main = new_main.replace(include_marker, include_marker + "\n" + include_line)
    else:
        raise SystemExit("sync router include marker not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: admin page router extracted and connected")
