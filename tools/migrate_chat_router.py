"""Extract chat routes from main.py into routers/chat.py.

This script updates the project by:
1. creating `routers/chat.py` from the existing chat helpers and chat endpoints;
2. importing `routers.chat` in main.py;
3. including `chat.router` after `promo_codes.router`;
4. removing legacy chat helper/endpoints from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
import textwrap
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"
CHAT_ROUTER_FILE = PROJECT_ROOT / "routers" / "chat.py"

IMPORT_OLD = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes\n"
IMPORT_NEW = "from routers import health, public_pages, delivery, uploads, analytics, categories, banners, reviews, promo_codes, chat\n"
PROMO_CODES_INCLUDE = "app.include_router(promo_codes.router)\n"
CHAT_INCLUDE = "app.include_router(chat.router)\n"

CHAT_HELPERS_RE = re.compile(
    r'''\n# --- CHAT SEARCH HELPERS ---\n'''
    r'''.*?'''
    r'''\n# --- APP ---\n''',
    re.DOTALL,
)

CHAT_ENDPOINTS_RE = re.compile(
    r'''\n@app\.post\("/chat", response_model=ChatResponse\)\n'''
    r'''.*?'''
    r'''\n@app\.post\("/upload"\)\n''',
    re.DOTALL,
)


def _build_router_content(chat_helpers: str, chat_endpoints: str) -> str:
    helpers = chat_helpers.strip()
    helpers = helpers.removesuffix("# --- APP ---").rstrip()

    endpoints = chat_endpoints.rstrip()
    endpoints = endpoints.removesuffix('@app.post("/upload")').rstrip()
    endpoints = endpoints.replace("@app.", "@router.")

    return textwrap.dedent(
        f'''\
        """Chat routes and chat search helpers."""

        from __future__ import annotations

        import json
        import os
        import re
        from typing import List

        from fastapi import APIRouter
        from models.schemas import ChatRequest, ChatResponse
        from db import get_db_connection
        from services.products import get_products_by_ids


        router = APIRouter()


        openai_client = None
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                from openai import AsyncOpenAI

                openai_client = AsyncOpenAI(api_key=api_key)
            except ImportError:
                openai_client = None


        {helpers}


        {endpoints}
        '''
    )


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    helpers_match = CHAT_HELPERS_RE.search(content)
    endpoints_match = CHAT_ENDPOINTS_RE.search(content)

    if not CHAT_ROUTER_FILE.exists():
        if not helpers_match or not endpoints_match:
            raise RuntimeError("Could not find chat helper/endpoints blocks in main.py")
        CHAT_ROUTER_FILE.write_text(
            _build_router_content(helpers_match.group(0), endpoints_match.group(0)),
            encoding="utf-8",
        )
        changed = True

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find promo_codes router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if CHAT_INCLUDE not in content:
        if PROMO_CODES_INCLUDE not in content:
            raise RuntimeError("Could not find promo_codes router include in main.py")
        content = content.replace(PROMO_CODES_INCLUDE, PROMO_CODES_INCLUDE + CHAT_INCLUDE, 1)
        changed = True

    content, helper_count = CHAT_HELPERS_RE.subn("\n# --- APP ---\n", content, count=1)
    changed = changed or helper_count > 0

    content, endpoint_count = CHAT_ENDPOINTS_RE.subn('\n@app.post("/upload")\n', content, count=1)
    changed = changed or endpoint_count > 0

    if changed:
        MAIN_FILE.write_text(content, encoding="utf-8")
        print("Updated project: chat router created/connected and legacy chat block removed from main.py.")
    else:
        print("No changes needed. Chat router migration is already applied.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
