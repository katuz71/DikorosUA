"""Remove legacy review endpoints from main.py.

`reviews.router` already provides review endpoints. Keeping the legacy endpoints
in main.py creates duplicate FastAPI route decorators and blocks
`tools/check_duplicate_routes.py`.

This script removes only the legacy reviews block from main.py and leaves the
following auth endpoint intact.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

REVIEWS_BLOCK_RE = re.compile(
    r'''\n# 5\.5 ОТЗЫВЫ\n'''
    r'''.*?'''
    r'''\n@app\.post\("/api/auth"\)\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    content, count = REVIEWS_BLOCK_RE.subn('\n@app.post("/api/auth")\n', content, count=1)

    if count == 0:
        print("No changes needed. Legacy reviews block is already removed from main.py.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: legacy reviews block removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
