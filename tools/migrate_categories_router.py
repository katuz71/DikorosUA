"""Connect categories router and remove legacy category routes from main.py.

This script updates main.py by:
1. importing `routers.categories`;
2. including `categories.router` after `analytics.router`;
3. removing the legacy category block from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from routers import health, public_pages, delivery, uploads, analytics\n"
IMPORT_NEW = "from routers import health, public_pages, delivery, uploads, analytics, categories\n"
ANALYTICS_INCLUDE = "app.include_router(analytics.router)\n"
CATEGORIES_INCLUDE = "app.include_router(categories.router)\n"

CATEGORIES_BLOCK_RE = re.compile(
    r'''\n# 3\. КАТЕГОРИИ\n'''
    r'''.*?'''
    r'''\n# 4\. БАННЕРЫ\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find analytics router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if CATEGORIES_INCLUDE not in content:
        if ANALYTICS_INCLUDE not in content:
            raise RuntimeError("Could not find analytics router include in main.py")
        content = content.replace(ANALYTICS_INCLUDE, ANALYTICS_INCLUDE + CATEGORIES_INCLUDE, 1)
        changed = True

    content, block_count = CATEGORIES_BLOCK_RE.subn("\n# 4. БАННЕРЫ\n", content, count=1)
    changed = changed or block_count > 0

    if not changed:
        print("No changes needed. Categories router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: categories router connected and legacy category block removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
