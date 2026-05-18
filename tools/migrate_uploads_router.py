"""Apply image/upload router migration.

This script updates main.py by:
1. importing `routers.uploads`;
2. including `uploads.router` after `delivery.router`;
3. switching the static uploads mount to `services.images.UPLOADS_DIR`;
4. removing the legacy `/api/image` endpoint implementation.

The legacy `_save_uploaded_image()` helper stays in main.py for now because
product create/update endpoints still call it. It will be removed when product
routes are split.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from routers import health, public_pages, delivery\n"
IMPORT_NEW = "from routers import health, public_pages, delivery, uploads\n"
SERVICE_IMPORT = "from services.images import UPLOADS_DIR\n"
DELIVERY_INCLUDE = "app.include_router(delivery.router)\n"
UPLOADS_INCLUDE = "app.include_router(uploads.router)\n"

UPLOADS_SETUP_RE = re.compile(
    r'''\nUPLOADS_DIR = os\.path\.abspath\(os\.getenv\("UPLOADS_DIR", "uploads"\)\)\n'''
    r'''os\.makedirs\(UPLOADS_DIR, exist_ok=True\)\n'''
    r'''app\.mount\("/uploads", StaticFiles\(directory=UPLOADS_DIR\), name="uploads"\)\n''',
    re.MULTILINE,
)

IMAGE_ENDPOINT_RE = re.compile(
    r'''\n\n@app\.get\("/api/image"\)\n'''
    r'''def get_resized_image\(.*?\n'''
    r'''    return FileResponse\(cached_path, media_type=media_type, headers=headers\)\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find delivery router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if SERVICE_IMPORT not in content:
        marker = IMPORT_NEW
        content = content.replace(marker, marker + SERVICE_IMPORT, 1)
        changed = True

    if UPLOADS_INCLUDE not in content:
        if DELIVERY_INCLUDE not in content:
            raise RuntimeError("Could not find delivery router include in main.py")
        content = content.replace(DELIVERY_INCLUDE, DELIVERY_INCLUDE + UPLOADS_INCLUDE, 1)
        changed = True

    content, setup_count = UPLOADS_SETUP_RE.subn(
        '\napp.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")\n',
        content,
        count=1,
    )
    changed = changed or setup_count > 0

    content, endpoint_count = IMAGE_ENDPOINT_RE.subn("\n", content, count=1)
    changed = changed or endpoint_count > 0

    if not changed:
        print("No changes needed. Uploads router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: uploads router connected and legacy /api/image removed.")
    print("Note: legacy _save_uploaded_image remains until product routes are split.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
