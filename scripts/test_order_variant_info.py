#!/usr/bin/env python3
"""Integration-ish test for order item variant preservation.

Runs by importing `create_order` from main.py and calling it directly.
That schedules background tasks but does NOT execute them in this script,
so no external webhooks are triggered.

Usage (inside docker app container):
  python3 scripts/test_order_variant_info.py
"""

import asyncio
import json
import os
import random
import string
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


# Ensure project root (where main.py lives) is importable when running as a script.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _dsn() -> str:
    return os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"


def _connect():
    return psycopg2.connect(_dsn(), cursor_factory=RealDictCursor)


def _clean(v: Any) -> str:
    return str(v or "").strip().replace("\u00a0", " ")


def _pick_product_with_variants() -> Optional[Dict[str, Any]]:
    """Find a product that likely has non-numeric variant labels (powder/whole/etc)."""
    needles = ["порош", "ціл", "мелен", "пудра", "capsul", "капсул", "форма"]
    where = " OR ".join(["variants ILIKE %s" for _ in needles])
    params = [f"%{n}%" for n in needles]

    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, name, unit, price, variants, option_names
            FROM products
            WHERE variants IS NOT NULL AND length(btrim(variants)) > 2
              AND ({where})
            ORDER BY id
            LIMIT 50
            """,
            params,
        )
        rows = cur.fetchall()

    for r in rows:
        try:
            variants = json.loads(r.get("variants") or "[]")
        except Exception:
            continue
        if not isinstance(variants, list) or not variants:
            continue
        # ensure at least one variant has a non-numeric-ish label
        for v in variants:
            label = _clean(v.get("name") if isinstance(v, dict) else "")
            if label and not label.isdigit():
                r["_variants"] = variants
                return r

    # fallback: any product with variants list
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, unit, price, variants, option_names
            FROM products
            WHERE variants IS NOT NULL AND length(btrim(variants)) > 2
            ORDER BY id
            LIMIT 50
            """
        )
        rows2 = cur.fetchall()

    for r in rows2:
        try:
            variants = json.loads(r.get("variants") or "[]")
        except Exception:
            continue
        if isinstance(variants, list) and variants:
            r["_variants"] = variants
            return r

    return None


def _pick_variant_label_and_price(variants: List[Dict[str, Any]]) -> Tuple[str, float]:
    best = None
    for v in variants:
        if not isinstance(v, dict):
            continue
        name = _clean(v.get("name") or v.get("title") or v.get("variant") or v.get("size") or v.get("packSize") or v.get("pack_size"))
        if not name:
            continue
        if any(x in name.lower() for x in ["порош", "ціл", "мелен", "капсул"]):
            best = v
            break
        if best is None:
            best = v

    if not best:
        return ("", 0.0)

    label = _clean(best.get("name") or best.get("title") or best.get("variant") or best.get("size") or best.get("packSize") or best.get("pack_size"))
    price = float(best.get("price") or 0) if str(best.get("price") or "").strip() else 0.0
    return (label, price)


def _rand_phone() -> str:
    return "09" + "".join(random.choice(string.digits) for _ in range(8))


async def _run() -> int:
    from fastapi import BackgroundTasks

    # Import after DB helpers to keep startup straightforward.
    from main import OrderRequest, create_order

    product = _pick_product_with_variants()
    if not product:
        raise SystemExit("FAIL: could not find any product with variants")

    variants = product.get("_variants")
    if not isinstance(variants, list) or not variants:
        raise SystemExit("FAIL: selected product has no parsed variants")

    label, vprice = _pick_variant_label_and_price(variants)  # label may be non-numeric
    unit = _clean(product.get("unit") or "шт")
    base_price = float(product.get("price") or 0)
    price = float(vprice or base_price or 0)
    if not label:
        label = unit

    phone = _rand_phone()

    # 3 cases: explicit variant_info, missing variant_info, alternative key variantSize
    items: List[Dict[str, Any]] = [
        {
            "id": int(product["id"]),
            "name": product["name"],
            "price": price,
            "quantity": 1,
            "unit": unit,
            "packSize": label,
            "variant_info": label,
        },
        {
            "id": int(product["id"]),
            "name": product["name"],
            "price": price,
            "quantity": 1,
            "unit": unit,
            "packSize": label,
            # variant_info intentionally omitted
        },
        {
            "id": int(product["id"]),
            "name": product["name"],
            "price": price,
            "quantity": 1,
            "unit": unit,
            "packSize": label,
            "variantSize": label,
        },
    ]

    total_price = sum(float(i.get("price") or 0) * int(i.get("quantity") or 1) for i in items)

    req = OrderRequest(
        name="TEST_VARIANT",
        phone=phone,
        email="test@example.com",
        contact_preference="telegram",
        city="TEST_CITY",
        cityRef="",
        warehouse="TEST_WAREHOUSE",
        warehouseRef="",
        items=items,
        totalPrice=total_price,
        payment_method="card",
        bonus_used=0,
        use_bonuses=False,
        user_phone=phone,
        promo_code=None,
        promo_discount_percent=0,
        promo_discount_amount=0,
        save_user_data=False,
    )

    bt = BackgroundTasks()
    res = await create_order(req, bt)
    oid = (res or {}).get("order_id")
    if not oid:
        raise SystemExit(f"FAIL: create_order returned no order_id: {res}")

    # Verify persistence
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT items FROM orders WHERE id=%s", (int(oid),))
        row = cur.fetchone() or {}
        raw = row.get("items") or "[]"

    try:
        stored = json.loads(raw)
    except Exception as e:
        raise SystemExit(f"FAIL: could not parse stored items JSON: {e}")

    if not isinstance(stored, list) or len(stored) != 3:
        raise SystemExit(f"FAIL: expected 3 stored items, got {type(stored)} len={len(stored) if isinstance(stored, list) else 'n/a'}")

    # Assertions
    for idx, it in enumerate(stored):
        if not isinstance(it, dict):
            raise SystemExit(f"FAIL: item[{idx}] not dict")
        vi = it.get("variant_info")
        ps = it.get("packSize")
        if not ps or not str(ps).strip():
            raise SystemExit(f"FAIL: item[{idx}] missing packSize")
        if not vi or not str(vi).strip():
            raise SystemExit(f"FAIL: item[{idx}] missing variant_info")

    # Case-specific checks
    if stored[0].get("variant_info") != label:
        raise SystemExit(f"FAIL: item[0] variant_info mismatch: {stored[0].get('variant_info')} != {label}")
    if stored[1].get("variant_info") != label:
        raise SystemExit(f"FAIL: item[1] variant_info should be backfilled from packSize: {stored[1].get('variant_info')} != {label}")
    if stored[2].get("variant_info") != label:
        raise SystemExit(f"FAIL: item[2] variant_info should be taken from variantSize: {stored[2].get('variant_info')} != {label}")

    # Cleanup: remove test order and test user.
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM orders WHERE id=%s", (int(oid),))
        cur.execute("DELETE FROM users WHERE phone=%s", (phone,))
        conn.commit()

    print("PASS: order items persisted with variant_info", {"order_id": oid, "product_id": product["id"], "label": label})
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
