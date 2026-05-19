"""Patch product normalizer into services.products and update main.py.

The previous extraction script can be a no-op when the exact legacy helper
shape differs. This patch is intentionally simpler:
1. adds a standalone `normalize_product_row()` implementation to services/products.py;
2. imports it in main.py;
3. replaces `_normalize_product_row(` calls with `normalize_product_row(`.

It does not try to remove an old helper because current main.py may not contain
its definition in the expected shape. Removing dead code can be done later.
"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"
PRODUCTS_SERVICE_FILE = PROJECT_ROOT / "services" / "products.py"

IMPORT_OLD = "from services.products import get_products_by_ids\n"
IMPORT_NEW = "from services.products import get_products_by_ids, normalize_product_row\n"

NORMALIZER_IMPL = r'''

def normalize_product_row(row: dict) -> dict:
    """Normalize a product DB row for API responses."""
    import json

    d = dict(row)

    discount = d.get("discount", 0)
    d["discount"] = discount if discount is not None else 0

    for key in ("is_bestseller", "is_promotion", "is_new", "is_hit"):
        if key in d:
            d[key] = bool(d.get(key))

    old_price = d.get("old_price")
    if old_price in (None, "", 0, 0.0):
        d["old_price"] = None

    variants_value = d.get("variants")
    if isinstance(variants_value, str):
        try:
            parsed = json.loads(variants_value) if variants_value.strip() else []
            d["variants"] = parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            d["variants"] = []
    elif isinstance(variants_value, list):
        d["variants"] = variants_value
    else:
        d["variants"] = []

    images_value = d.get("images")
    if isinstance(images_value, str):
        try:
            parsed_images = json.loads(images_value) if images_value.strip() else []
            if isinstance(parsed_images, list):
                d["images"] = parsed_images
        except (json.JSONDecodeError, TypeError):
            pass

    return d
'''


def main() -> int:
    main_content = MAIN_FILE.read_text(encoding="utf-8")
    service_content = PRODUCTS_SERVICE_FILE.read_text(encoding="utf-8")
    changed = False

    if "def normalize_product_row(" not in service_content:
        service_content = service_content.rstrip() + NORMALIZER_IMPL + "\n"
        PRODUCTS_SERVICE_FILE.write_text(service_content, encoding="utf-8")
        changed = True

    if IMPORT_NEW not in main_content:
        if IMPORT_OLD not in main_content:
            raise RuntimeError("Could not find services.products import in main.py")
        main_content = main_content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if "_normalize_product_row(" in main_content:
        main_content = main_content.replace("_normalize_product_row(", "normalize_product_row(")
        changed = True

    if changed:
        MAIN_FILE.write_text(main_content, encoding="utf-8")
        print("Patched product normalizer service and updated main.py references.")
    else:
        print("No changes needed. Product normalizer patch is already applied.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
