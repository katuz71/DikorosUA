"""Restore CHAT_PRODUCTS_BASE and ID helpers into routers/chat.py.

The chat extraction accidentally removed `CHAT_PRODUCTS_BASE` and related ID
extraction helpers from the current code. This script restores that block from
Git history and inserts it into `routers/chat.py` before the chat search helpers.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CHAT_FILE = PROJECT_ROOT / "routers" / "chat.py"

SOURCE_COMMIT = "2444ad37100cdd1ff4795259fe6554e8b2533f28"
INSERT_MARKER = "# --- CHAT SEARCH HELPERS ---"

CHAT_PRODUCTS_BLOCK_RE = re.compile(
    r'''\n# --- CHAT BOT:.*?'''
    r'''\n\n@app\.post\("/upload"\)\n''',
    re.DOTALL,
)


def main() -> int:
    if not CHAT_FILE.exists():
        raise RuntimeError("routers/chat.py does not exist")

    chat_content = CHAT_FILE.read_text(encoding="utf-8")
    if "CHAT_PRODUCTS_BASE" in chat_content:
        print("No changes needed. CHAT_PRODUCTS_BASE is already present in routers/chat.py.")
        return 0

    old_main = subprocess.check_output(
        ["git", "show", f"{SOURCE_COMMIT}:main.py"],
        cwd=PROJECT_ROOT,
        text=True,
        encoding="utf-8",
    )
    match = CHAT_PRODUCTS_BLOCK_RE.search(old_main)
    if not match:
        raise RuntimeError("Could not find CHAT_PRODUCTS_BASE block in historical main.py")

    block = match.group(0)
    block = block.rsplit('@app.post("/upload")', 1)[0].strip()

    if INSERT_MARKER not in chat_content:
        raise RuntimeError("Could not find chat search helper marker in routers/chat.py")

    chat_content = chat_content.replace(INSERT_MARKER, block + "\n\n\n" + INSERT_MARKER, 1)
    CHAT_FILE.write_text(chat_content, encoding="utf-8")
    print("Restored CHAT_PRODUCTS_BASE and ID helpers into routers/chat.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
