"""Apply public pages router migration.

This script updates main.py by:
1. importing `routers.public_pages`;
2. including `public_pages.router` after the health router include;
3. removing legacy public HTML page endpoints from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from routers import health\n"
IMPORT_NEW = "from routers import health, public_pages\n"
HEALTH_INCLUDE = "app.include_router(health.router)\n"
PUBLIC_INCLUDE = "app.include_router(public_pages.router)\n"

LEGACY_BLOCKS = [
    '''\n\n@app.get("/delete-account", response_class=HTMLResponse)\nasync def get_delete_account(request: Request):\n    """Сторінка запиту на видалення акаунта (публічна, без авторизації; для відповідності політиці Google Play)."""\n    return templates.TemplateResponse("delete_account.html", {"request": request})\n''',
    '''\n\n@app.get("/privacy-policy", response_class=HTMLResponse)\nasync def get_privacy_page(request: Request):\n    """Публічна сторінка політики конфіденційності."""\n    return templates.TemplateResponse("privacy_policy.html", {"request": request})\n''',
    '''\n\n@app.get("/delivery-payment", response_class=HTMLResponse)\nasync def get_delivery_page(request: Request):\n    return templates.TemplateResponse("delivery_payment.html", {"request": request})\n''',
    '''\n\n@app.get("/returns", response_class=HTMLResponse)\nasync def get_returns_page(request: Request):\n    return templates.TemplateResponse("returns.html", {"request": request})\n''',
    '''\n\n@app.get("/about", response_class=HTMLResponse)\nasync def get_about_page(request: Request):\n    return templates.TemplateResponse("about.html", {"request": request})\n''',
]


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find health router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if PUBLIC_INCLUDE not in content:
        if HEALTH_INCLUDE not in content:
            raise RuntimeError("Could not find health router include in main.py")
        content = content.replace(HEALTH_INCLUDE, HEALTH_INCLUDE + PUBLIC_INCLUDE, 1)
        changed = True

    for block in LEGACY_BLOCKS:
        if block in content:
            content = content.replace(block, "\n", 1)
            changed = True

    if not changed:
        print("No changes needed. Public pages router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: public pages router connected and legacy public pages removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
