#!/usr/bin/env python3
"""Smoke test: verify Apix payload includes normalized variant_info.

This does NOT send any webhook. It only builds the payload the backend would
send to Apix Drive.

Run inside docker app container:
  python3 scripts/test_apix_payload_smoke.py
"""

import json
import os
import random
import string
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _dsn() -> str:
    return os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"


def _connect():
    return psycopg2.connect(_dsn(), cursor_factory=RealDictCursor)


def _clean(v: Any) -> str:
    return str(v or "").strip().replace("\u00a0", " ")


def _rand_phone() -> str:
    return "09" + "".join(random.choice(string.digits) for _ in range(8))


def _pick_product_with_variants() -> Optional[Dict[str, Any]]:
    needles = ["порош", "ціл", "мелен", "пудра", "капсул", "capsul", "форма"]
    where = " OR ".join(["variants ILIKE %s" for _ in needles])
    params = [f"%{n}%" for n in needles]

    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, name, unit, price, variants
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
        if isinstance(variants, list) and variants:
            r["_variants"] = variants
            return r

    # fallback: any product with variants
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, unit, price, variants
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
    price_raw = best.get("price")
    price = float(price_raw) if str(price_raw or "").strip() else 0.0
    return (label, price)


def main() -> int:
    from main import OrderRequest, _normalize_order_items, build_apix_order_payload

    product = _pick_product_with_variants()
    if not product:
        raise SystemExit("FAIL: could not find a product with variants")

    variants = product.get("_variants")
    if not isinstance(variants, list) or not variants:
        raise SystemExit("FAIL: selected product has no parsed variants")

    label, vprice = _pick_variant_label_and_price(variants)
    unit = _clean(product.get("unit") or "шт")
    base_price = float(product.get("price") or 0)
    price = float(vprice or base_price or 0)
    if not label:
        label = unit

    phone = _rand_phone()
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
            # variant_info intentionally missing
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

    items_norm = _normalize_order_items(items)
    if len(items_norm) != 3:
        raise SystemExit(f"FAIL: expected 3 normalized items, got {len(items_norm)}")

    req = OrderRequest(
        name="TEST_PAYLOAD",
        phone=phone,
        email="test@example.com",
        contact_preference="telegram",
        city="TEST_CITY",
        cityRef="CITYREF",
        warehouse="TEST_WH",
        warehouseRef="WHREF",
        items=items,
        totalPrice=price * 3,
        payment_method="card",
        bonus_used=0,
        use_bonuses=False,
        user_phone=phone,
        promo_code=None,
        promo_discount_percent=0,
        promo_discount_amount=0,
        save_user_data=False,
    )

    payload = build_apix_order_payload(req, oid=9999, items_norm=items_norm)

    # Core checks
    if payload.get("id") != 9999:
        raise SystemExit(f"FAIL: payload id mismatch: {payload.get('id')}")

    for idx, it in enumerate(payload.get("items") or []):
        vi = _clean(it.get("variant_info"))
        ps = _clean(it.get("packSize"))
        if not ps:
            raise SystemExit(f"FAIL: payload item[{idx}] missing packSize")
        if not vi:
            raise SystemExit(f"FAIL: payload item[{idx}] missing variant_info")
        if vi != label:
            raise SystemExit(f"FAIL: payload item[{idx}] variant_info mismatch: {vi} != {label}")

    # Presence of key checkout fields (don’t assert non-empty for optional ones)
    for k in ["name", "phone", "user_phone", "email", "contact_preference", "city", "warehouse", "payment_method", "totalPrice"]:
        if k not in payload:
            raise SystemExit(f"FAIL: payload missing key: {k}")

    print(
        "PASS: apix payload contains normalized items",
        {"product_id": product["id"], "label": label, "keys": sorted(list(payload.keys()))[:12]},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
