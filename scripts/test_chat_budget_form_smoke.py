#!/usr/bin/env python3
"""Smoke test: chat should respect form/budget hints and still sell.

Run inside docker app container:
  python3 scripts/test_chat_budget_form_smoke.py
"""

import asyncio
import sys
from pathlib import Path
from typing import Any, Dict

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


async def _run() -> int:
    from main import ChatRequest, ChatMessage, chat

    # Budget + form cues (capsules) + intent (immunity)
    user_text = "Хочу щось для імунітету в капсулах, бюджет до 500 грн"
    req = ChatRequest(messages=[ChatMessage(role="user", content=user_text)])
    res: Dict[str, Any] = await chat(req)

    text = (res.get("text") or "")
    products = res.get("products") or []

    if not products:
        raise SystemExit("FAIL: expected products")

    low = text.lower()
    if ("кошик" not in low and "корз" not in low):
        raise SystemExit("FAIL: missing CTA about cart")
    if not text.strip().endswith("?"):
        raise SystemExit("FAIL: should end with a question")

    print("PASS: budget/form query returns products and closing question", {"count": len(products)})
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
