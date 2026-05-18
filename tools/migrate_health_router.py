"""Apply the first safe router migration: health endpoint.

This script updates main.py by:
1. importing `routers.health`;
2. including `health.router` after `app = FastAPI()`;
3. removing the legacy `@app.get("/health")` function.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

LEGACY_HEALTH_BLOCK = '''\n\n@app.get("/health")\ndef health_check():\n    return {"status": "ok", "message": "Server is running"}\n'''

IMPORT_LINE = "from routers import health\n"
APP_LINE = "app = FastAPI()\n"
INCLUDE_LINE = "app.include_router(health.router)\n"


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_LINE not in content:
        marker = "from services.onebox_api import create_onebox_order, OneBoxDbSession, Product\n"
        if marker not in content:
            raise RuntimeError("Could not find import marker in main.py")
        content = content.replace(marker, marker + IMPORT_LINE)
        changed = True

    if INCLUDE_LINE not in content:
        if APP_LINE not in content:
            raise RuntimeError("Could not find app = FastAPI() in main.py")
        content = content.replace(APP_LINE, APP_LINE + INCLUDE_LINE, 1)
        changed = True

    if LEGACY_HEALTH_BLOCK in content:
        content = content.replace(LEGACY_HEALTH_BLOCK, "\n", 1)
        changed = True

    if not changed:
        print("No changes needed. Health router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: health router connected and legacy /health removed.")
    print("Next check: python tools/check_duplicate_routes.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
