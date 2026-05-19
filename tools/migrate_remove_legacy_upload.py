"""Remove legacy /upload endpoint from main.py.

`uploads.router` already provides POST /upload. Keeping the legacy endpoint in
main.py creates a duplicate FastAPI route decorator and blocks
`tools/check_duplicate_routes.py`.

This script removes only the legacy upload endpoint from main.py and leaves the
next `/upload_csv` endpoint intact.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

UPLOAD_BLOCK_RE = re.compile(
    r'''\n@app\.post\("/upload"\)\n'''
    r'''.*?'''
    r'''\n@app\.post\("/upload_csv"\)\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    content, count = UPLOAD_BLOCK_RE.subn('\n@app.post("/upload_csv")\n', content, count=1)

    if count == 0:
        print("No changes needed. Legacy /upload endpoint is already removed from main.py.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: legacy /upload endpoint removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
