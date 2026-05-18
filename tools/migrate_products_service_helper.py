"""Move get_products_by_ids usage to services.products.

This script updates main.py by:
1. importing `get_products_by_ids` from `services.products`;
2. removing duplicate local `get_products_by_ids()` from main.py.

This prepares chat router extraction without importing helpers from main.py.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_MARKER = "from services.users import (\n"
PRODUCTS_IMPORT = "from services.products import get_products_by_ids\n"

GET_PRODUCTS_BY_IDS_RE = re.compile(
    r'''\n\ndef get_products_by_ids\(ids: List\[int\]\) -> List\[dict\]:\n'''
    r'''.*?'''
    r'''    return \[by_id\[i\] for i in ids if i in by_id\]\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if PRODUCTS_IMPORT not in content:
        if IMPORT_MARKER not in content:
            raise RuntimeError("Could not find services.users import marker in main.py")
        content = content.replace(IMPORT_MARKER, PRODUCTS_IMPORT + IMPORT_MARKER, 1)
        changed = True

    content, helper_count = GET_PRODUCTS_BY_IDS_RE.subn("\n", content, count=1)
    changed = changed or helper_count > 0

    if not changed:
        print("No changes needed. Products service helper migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: using services.products.get_products_by_ids and removed duplicate helper.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
