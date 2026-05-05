import argparse
import os
import sqlite3
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


TEXT_COLUMNS = {
    "name",
    "image",
    "images",
    "category",
    "pack_sizes",
    "unit",
    "description",
    "usage",
    "delivery_info",
    "return_info",
    "variants",
    "option_names",
    "external_id",
    "composition",
    "group_id",
}


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.environ.get(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def connect_postgres() -> "psycopg2.extensions.connection":
    # main.py in this repo uses this fallback when DATABASE_URL is not set
    database_url = _env("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def sqlite_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [r[1] for r in rows]


def fetch_sqlite_products(conn: sqlite3.Connection, columns: Sequence[str]) -> Iterable[Dict[str, Any]]:
    cols_sql = ", ".join([f"{c}" for c in columns])
    cur = conn.execute(f"SELECT {cols_sql} FROM products")
    names = [d[0] for d in cur.description]
    for row in cur.fetchall():
        yield {names[i]: row[i] for i in range(len(names))}


def _is_nonempty_text(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip()
    return bool(s) and s not in {"null", "undefined"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync SQLite shop.db into production Postgres (upsert by external_id).")
    ap.add_argument("--sqlite", default="/app/_incoming/shop.db", help="Path to uploaded SQLite shop.db")
    ap.add_argument("--dry-run", action="store_true", help="Do not write changes; only print stats")
    args = ap.parse_args()

    sqlite_path = args.sqlite
    if not os.path.exists(sqlite_path):
        raise SystemExit(f"SQLite file not found: {sqlite_path}")

    sconn = sqlite3.connect(sqlite_path)
    sconn.row_factory = sqlite3.Row
    scolumns = sqlite_columns(sconn, "products")
    scolset = set(scolumns)

    if "external_id" not in scolset:
        raise SystemExit("SQLite products table must have external_id for safe sync.")

    # Only take columns that exist in Postgres products table.
    pconn = connect_postgres()
    with pconn:
        with pconn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='products'
                ORDER BY ordinal_position
                """
            )
            pcols = [r["column_name"] for r in cur.fetchall()]

    # We never set id explicitly.
    target_cols = [c for c in pcols if c != "id" and c in scolset]
    # Ensure external_id is present and first.
    if "external_id" not in target_cols:
        target_cols.insert(0, "external_id")
    else:
        target_cols = ["external_id"] + [c for c in target_cols if c != "external_id"]

    insert_cols_sql = ", ".join(target_cols)
    placeholders_sql = ", ".join(["%s"] * len(target_cols))

    # Build conflict update clause.
    update_parts: List[str] = []
    for c in target_cols:
        if c == "external_id":
            continue
        if c in TEXT_COLUMNS:
            update_parts.append(
                f"{c} = CASE WHEN excluded.{c} IS NULL OR excluded.{c} = '' THEN products.{c} ELSE excluded.{c} END"
            )
        else:
            update_parts.append(f"{c} = COALESCE(excluded.{c}, products.{c})")
    update_sql = ", ".join(update_parts)

    upsert_sql = (
        f"INSERT INTO products ({insert_cols_sql}) VALUES ({placeholders_sql}) "
        f"ON CONFLICT (external_id) DO UPDATE SET {update_sql}"
    )

    rows: List[Tuple[Any, ...]] = []
    total = 0
    for prod in fetch_sqlite_products(sconn, target_cols):
        total += 1
        ext = prod.get("external_id")
        if not _is_nonempty_text(ext):
            continue
        rows.append(tuple(prod.get(c) for c in target_cols))

    print(f"SQLite file: {sqlite_path}")
    print(f"SQLite products rows: {total}")
    print(f"Upsert rows prepared: {len(rows)}")
    print(f"Columns synced: {target_cols}")

    if args.dry_run:
        print("DRY RUN: no changes applied")
        return 0

    with pconn:
        with pconn.cursor() as cur:
            cur.executemany(upsert_sql, rows)

    print("OK: sync applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
