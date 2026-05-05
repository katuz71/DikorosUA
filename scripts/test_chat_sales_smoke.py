#!/usr/bin/env python3
"""Smoke test for chat: should recommend relevant products + include purchase CTA.

Runs by importing and calling the FastAPI chat handler directly.
No external webhooks are involved.

Run inside docker app container:
  python3 scripts/test_chat_sales_smoke.py
"""

import asyncio
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _dsn() -> str:
    return os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"


def _connect():
    return psycopg2.connect(_dsn(), cursor_factory=RealDictCursor)


def _pick_keyword() -> str:
    """Pick a keyword from an existing product name to make the test resilient."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT name
            FROM products
            WHERE name IS NOT NULL AND length(btrim(name)) > 6
            ORDER BY id DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall() or []

    for r in rows:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        # pick first meaningful word (letters only)
        words = re.findall(r"[A-Za-zА-Яа-яІіЇїЄєҐґ]{4,}", name)
        if words:
            return words[0]

    return "гриби"


async def _run() -> int:
    from main import ChatRequest, ChatMessage, chat

    kw = _pick_keyword()

    # This used to be treated as "too generic"; now it should still return products.
    user_text = f"Посоветуй {kw}"

    req = ChatRequest(messages=[ChatMessage(role="user", content=user_text)])
    res: Dict[str, Any] = await chat(req)

    text = (res.get("text") or "").strip()
    products = res.get("products") or []

    if not text:
        raise SystemExit("FAIL: empty chat text")

    if not isinstance(products, list):
        raise SystemExit(f"FAIL: products not list: {type(products)}")

    if len(products) == 0:
        raise SystemExit(f"FAIL: expected at least 1 recommended product for '{user_text}', got 0")

    # Purchase CTA must be present (ru/uk variants)
    low = text.lower()
    if ("карточ" not in low and "картк" not in low) or ("корз" not in low and "кошик" not in low):
        raise SystemExit("FAIL: missing purchase CTA in chat text")

    # Basic schema check
    p0 = products[0] or {}
    for k in ["id", "name", "price"]:
        if k not in p0:
            raise SystemExit(f"FAIL: product payload missing key: {k}")

    print("PASS: chat recommends products + includes CTA", {"query": user_text, "count": len(products)})
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
