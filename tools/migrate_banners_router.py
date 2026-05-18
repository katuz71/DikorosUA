"""Connect banners router and remove legacy banner routes from main.py.

This script updates main.py by:
1. importing `routers.banners`;
2. including `banners.router` after `categories.router`;
3. removing the legacy banners block from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from routers import health, public_pages, delivery, uploads, analytics, categories\n"
IMPORT_NEW = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners\n"
CATEGORIES_INCLUDE = "app.include_router(categories.router)\n"
BANNERS_INCLUDE = "app.include_router(banners.router)\n"

BANNERS_BLOCK_RE = re.compile(
    r'''\n# 4\. БАННЕРЫ\n'''
    r'''.*?'''
    r'''\n# 5\. ПОЛЬЗОВАТЕЛИ\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find categories router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if BANNERS_INCLUDE not in content:
        if CATEGORIES_INCLUDE not in content:
            raise RuntimeError("Could not find categories router include in main.py")
        content = content.replace(CATEGORIES_INCLUDE, CATEGORIES_INCLUDE + BANNERS_INCLUDE, 1)
        changed = True

    content, block_count = BANNERS_BLOCK_RE.subn("\n# 5. ПОЛЬЗОВАТЕЛИ\n", content, count=1)
    changed = changed or block_count > 0

    if not changed:
        print("No changes needed. Banners router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: banners router connected and legacy banners block removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
