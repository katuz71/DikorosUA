"""Apply image helper usage migration.

This script updates main.py by:
1. importing `save_uploaded_image` from `services.images`;
2. replacing legacy `_save_uploaded_image(...)` calls with `save_uploaded_image(...)`;
3. removing legacy `_save_uploaded_image()` from main.py.

This prepares category/product routers to use a shared image upload helper without
importing from main.py.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from services.images import UPLOADS_DIR\n"
IMPORT_NEW = "from services.images import UPLOADS_DIR, save_uploaded_image\n"

SAVE_HELPER_RE = re.compile(
    r'''\n\nasync def _save_uploaded_image\(file: UploadFile\) -> str:\n'''
    r'''.*?'''
    r'''    return f"/uploads/\{name\}"\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find services.images import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if "_save_uploaded_image(" in content:
        content = content.replace("_save_uploaded_image(", "save_uploaded_image(")
        changed = True

    content, helper_count = SAVE_HELPER_RE.subn("\n", content, count=1)
    changed = changed or helper_count > 0

    if not changed:
        print("No changes needed. Image helper usage migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: using services.images.save_uploaded_image and removed legacy helper.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
