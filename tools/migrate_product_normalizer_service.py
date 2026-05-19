"""Move product row normalizer from main.py to services.products.

This script updates the project by:
1. extracting `_normalize_product_row()` from main.py;
2. appending it to `services/products.py` as `normalize_product_row()`;
3. importing `normalize_product_row` in main.py;
4. replacing `_normalize_product_row(...)` calls with `normalize_product_row(...)`;
5. removing the local helper from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"
PRODUCTS_SERVICE_FILE = PROJECT_ROOT / "services" / "products.py"

IMPORT_OLD = "from services.products import get_products_by_ids\n"
IMPORT_NEW = "from services.products import get_products_by_ids, normalize_product_row\n"

NORMALIZER_RE = re.compile(
    r'''\n\ndef _normalize_product_row\(row: dict\) -> dict:\n'''
    r'''.*?'''
    r'''    return d\n''',
    re.DOTALL,
)


def main() -> int:
    main_content = MAIN_FILE.read_text(encoding="utf-8")
    service_content = PRODUCTS_SERVICE_FILE.read_text(encoding="utf-8")
    changed_main = False
    changed_service = False

    match = NORMALIZER_RE.search(main_content)

    if "def normalize_product_row(" not in service_content:
        if not match:
            raise RuntimeError("Could not find _normalize_product_row() in main.py")
        normalizer = match.group(0).strip()
        normalizer = normalizer.replace("def _normalize_product_row(row: dict) -> dict:", "def normalize_product_row(row: dict) -> dict:", 1)
        service_content = service_content.rstrip() + "\n\n\n" + normalizer + "\n"
        changed_service = True

    if IMPORT_NEW not in main_content:
        if IMPORT_OLD not in main_content:
            raise RuntimeError("Could not find services.products import in main.py")
        main_content = main_content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed_main = True

    if "_normalize_product_row(" in main_content:
        main_content = main_content.replace("_normalize_product_row(", "normalize_product_row(")
        changed_main = True

    main_content, removed_count = NORMALIZER_RE.subn("\n", main_content, count=1)
    changed_main = changed_main or removed_count > 0

    if changed_service:
        PRODUCTS_SERVICE_FILE.write_text(service_content, encoding="utf-8")
    if changed_main:
        MAIN_FILE.write_text(main_content, encoding="utf-8")

    if changed_main or changed_service:
        print("Updated project: product normalizer moved to services.products.")
    else:
        print("No changes needed. Product normalizer migration is already applied.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
