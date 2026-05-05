#!/usr/bin/env python3
import argparse
import os
import re
from typing import Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


_COPY_RE = re.compile(r"^COPY\s+(?:public\.)?products\s*\((.*?)\)\s+FROM\s+stdin;\s*$", re.IGNORECASE)


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def connect_postgres():
    database_url = _env("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def _unescape_copy_text_field(v: str) -> str:
    # Postgres COPY text format uses backslash escapes.
    out_chars: List[str] = []
    i = 0
    while i < len(v):
        ch = v[i]
        if ch != "\\":
            out_chars.append(ch)
            i += 1
            continue
        i += 1
        if i >= len(v):
            out_chars.append("\\")
            break
        esc = v[i]
        i += 1
        if esc == "n":
            out_chars.append("\n")
        elif esc == "r":
            out_chars.append("\r")
        elif esc == "t":
            out_chars.append("\t")
        elif esc == "b":
            out_chars.append("\b")
        elif esc == "f":
            out_chars.append("\f")
        elif esc == "v":
            out_chars.append("\v")
        elif esc == "\\":
            out_chars.append("\\")
        else:
            # Keep unknown escapes as literal
            out_chars.append(esc)
    return "".join(out_chars)


def extract_descriptions(dump_path: str) -> Tuple[Dict[int, Optional[str]], List[str]]:
    """Return mapping id->description (raw text, may include newlines) from a pg_dump SQL (COPY text format)."""

    errors: List[str] = []
    with open(dump_path, "r", encoding="utf-8", errors="replace") as f:
        in_copy = False
        col_names: List[str] = []
        id_idx = desc_idx = -1
        out: Dict[int, Optional[str]] = {}

        for line in f:
            if not in_copy:
                m = _COPY_RE.match(line.strip())
                if not m:
                    continue
                cols_blob = m.group(1)
                col_names = [c.strip().strip('"') for c in cols_blob.split(",")]
                try:
                    id_idx = col_names.index("id")
                except ValueError:
                    errors.append("COPY products: no 'id' column")
                    return {}, errors
                try:
                    desc_idx = col_names.index("description")
                except ValueError:
                    errors.append("COPY products: no 'description' column")
                    return {}, errors
                in_copy = True
                continue

            # inside COPY data
            if line == "\\.\n" or line.strip() == "\\.":
                break

            row = line.rstrip("\n")
            fields = row.split("\t")
            if id_idx >= len(fields) or desc_idx >= len(fields):
                # malformed row; skip
                continue

            raw_id = fields[id_idx]
            if not raw_id.isdigit():
                continue
            pid = int(raw_id)

            raw_desc = fields[desc_idx]
            if raw_desc == "\\N":
                out[pid] = None
            else:
                out[pid] = _unescape_copy_text_field(raw_desc)

        if not in_copy:
            errors.append("COPY products block not found in dump")
            return {}, errors

        return out, errors


def main() -> int:
    ap = argparse.ArgumentParser(description="Restore products.description from a pg_dump snapshot (no table import; updates description only).")
    ap.add_argument("--dump", required=True, help="Path to pg_dump .sql containing COPY products data")
    ap.add_argument("--apply", action="store_true", help="Write updates to DB")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    mapping, errs = extract_descriptions(args.dump)
    if errs:
        for e in errs:
            print(f"ERR: {e}")
        return 2

    conn = connect_postgres()
    with conn.cursor() as cur:
        cur.execute("SELECT id, description FROM products ORDER BY id")
        rows = cur.fetchall()

    planned: List[Tuple[int, int, int]] = []  # (id, old_len, new_len)
    updates: List[Tuple[int, str]] = []

    for row in rows:
        pid = int(row["id"])
        if pid not in mapping:
            continue
        new_desc = mapping.get(pid)
        if new_desc is None:
            continue
        current = (row.get("description") or "")
        if (current or "").strip() == (new_desc or "").strip():
            continue
        updates.append((pid, new_desc))
        planned.append((pid, len((current or "").strip()), len((new_desc or "").strip())))
        if args.limit and len(updates) >= int(args.limit):
            break

    print(f"Snapshot rows with description: {sum(1 for v in mapping.values() if v)}")
    print(f"Planned restores: {len(updates)} apply={bool(args.apply)}")
    if planned:
        print("Examples (first 3):")
        for pid, old_len, new_len in planned[:3]:
            print(f"- id={pid} old_len={old_len} new_len={new_len}")

    if not args.apply:
        print("DRY RUN: no changes applied")
        return 0

    if not updates:
        print("No updates to apply")
        return 0

    with conn:
        with conn.cursor() as cur:
            for pid, new_desc in updates:
                cur.execute("UPDATE products SET description=%s WHERE id=%s", (new_desc, pid))

    print("OK: restores applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
