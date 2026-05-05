#!/usr/bin/env python3
import argparse
import datetime as _dt
import html as _html
import json
import os
import re
import xml.etree.ElementTree as ET
from typing import Dict, Iterable, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


_TAG_RE = re.compile(r"<[^>]+>")
_A_TAG_RE = re.compile(r"<\s*a\b[^>]*>(.*?)<\s*/\s*a\s*>", re.IGNORECASE | re.DOTALL)
_BR_RE = re.compile(r"<\s*br\s*/?\s*>", re.IGNORECASE)
_P_CLOSE_RE = re.compile(r"<\s*/\s*p\s*>", re.IGNORECASE)
_P_OPEN_RE = re.compile(r"<\s*p\b[^>]*>", re.IGNORECASE)
_LI_OPEN_RE = re.compile(r"<\s*li\b[^>]*>", re.IGNORECASE)
_LI_CLOSE_RE = re.compile(r"<\s*/\s*li\s*>", re.IGNORECASE)
_H_OPEN_RE = re.compile(r"<\s*h[1-6]\b[^>]*>", re.IGNORECASE)
_H_CLOSE_RE = re.compile(r"<\s*/\s*h[1-6]\s*>", re.IGNORECASE)
_UL_OPEN_RE = re.compile(r"<\s*ul\b[^>]*>", re.IGNORECASE)
_UL_CLOSE_RE = re.compile(r"<\s*/\s*ul\s*>", re.IGNORECASE)


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def connect_postgres():
    database_url = _env("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def _split_external_ids(raw: str) -> List[str]:
    if not raw:
        return []
    parts = []
    for p in raw.split(","):
        p = p.strip()
        if p:
            parts.append(p)
    return parts


def _clean_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\u00a0", " ")).strip()


def _drop_noise_lines(lines: List[str]) -> List[str]:
    """Remove boilerplate that is not product-specific (certificates/FAQ/shipping links).

    This is intended as *visual cleanup*; it does not add new claims or new meaning.
    """

    noise_patterns = [
        r"\bТУ\s*ТУ\s*У\b",
        r"якість\s+підтверджена\s+сертифікат",
        r"качество\s+подтверждено\s+сертификат",
        r"сертифікат\w*\s+якост",
        r"sertifikaty[-_ ]yakosti|sertifikaty-yakosti",
        r"poshyreni[-_ ]pytannia|poshyreni-pytannia",
        r"mizhnarodni[-_ ]vidpravky|mizhnarodni-vidpravky",
        r"Продукт\s+виготовлено\s+згідно",
        r"Виготовлено\s+згідно",
        r"Більше\s+інформац",
        r"Якщо\s+Ви\s+бажаєте\s+зробити\s+замовлення\s+в\s+іншу\s+країн",
        r"ознайомтеся\s+з\s+умовами\s+за\s+посиланням",
        r"распространен\w*\s+вопрос",
        r"додаткових\s+питань",
        r"http[s]?://\S+",
    ]

    out: List[str] = []
    for line in lines:
        s = (line or "").strip()
        if not s:
            out.append("")
            continue
        s_l = s.lower()
        # Strip pure "dot" lines and artifacts
        if s_l in {".", "•", "-", "–", "—"}:
            continue
        if any(re.search(pat, s, flags=re.IGNORECASE) for pat in noise_patterns):
            continue
        out.append(s)

    # Collapse multiple blank lines
    collapsed: List[str] = []
    prev_blank = False
    for line in out:
        blank = not line.strip()
        if blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = blank

    # Trim leading/trailing blanks
    while collapsed and not collapsed[0].strip():
        collapsed.pop(0)
    while collapsed and not collapsed[-1].strip():
        collapsed.pop()

    return collapsed


def clean_horoshop_html_to_text(raw_html: str) -> str:
    if not raw_html:
        return ""

    t = _html.unescape(raw_html)

    # Keep anchor text, drop URLs/attrs
    t = _A_TAG_RE.sub(lambda m: m.group(1) or "", t)

    # Normalize structural tags to newlines/bullets
    t = _BR_RE.sub("\n", t)
    t = _P_OPEN_RE.sub("", t)
    t = _P_CLOSE_RE.sub("\n", t)

    # Headings -> new line + heading text
    t = _H_OPEN_RE.sub("\n", t)
    t = _H_CLOSE_RE.sub("\n", t)

    # Lists
    t = _UL_OPEN_RE.sub("\n", t)
    t = _UL_CLOSE_RE.sub("\n", t)
    t = _LI_OPEN_RE.sub("\n- ", t)
    t = _LI_CLOSE_RE.sub("", t)

    # Strip remaining tags
    t = _TAG_RE.sub(" ", t)

    # Normalize whitespace per line
    raw_lines = [
        _clean_spaces(line)
        for line in t.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]

    # Turn "header: value" blocks into bullets when appropriate (pure visual)
    lines: List[str] = []
    for line in raw_lines:
        if not line:
            lines.append("")
            continue
        # Normalize common pseudo-bullets
        if re.match(r"^[•\u2022\u25CF\u25AA\u25E6]\s+", line):
            line = "- " + re.sub(r"^[•\u2022\u25CF\u25AA\u25E6]\s+", "", line)
        if re.match(r"^[-–—]\s*\S", line) and not line.startswith("- "):
            line = "- " + re.sub(r"^[-–—]\s*", "", line)
        lines.append(line)

    lines = _drop_noise_lines(lines)

    # If we have a "Властивості" (or similar) section followed by plain lines, convert them to bullets
    section_headers = {
        "властивості",
        "корисні властивості",
        "протипоказання",
        "склад",
        "опис",
        "спосіб застосування",
        "застосування",
    }

    out_lines: List[str] = []
    in_section = False
    for i, line in enumerate(lines):
        if not line:
            out_lines.append("")
            in_section = False
            continue

        norm = re.sub(r"[:\s]+$", "", line.strip()).lower()
        is_header = norm in section_headers or any(norm.startswith(h + " ") for h in section_headers)
        if is_header:
            out_lines.append(line.rstrip(":") + ":")
            in_section = True
            continue

        if in_section and not line.startswith("- "):
            # Only bulletize short-ish items; keep long paragraphs as-is.
            if len(line) <= 140:
                out_lines.append("- " + line)
            else:
                out_lines.append(line)
        else:
            out_lines.append(line)

    # Collapse multiple blank lines (again)
    final_lines: List[str] = []
    prev_blank = False
    for line in out_lines:
        blank = not line.strip()
        if blank and prev_blank:
            continue
        final_lines.append(line)
        prev_blank = blank

    return "\n".join(final_lines).strip()


def iter_offers(xml_path: str) -> Iterable[Tuple[str, Dict[str, str]]]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # yml_catalog/shop/offers/offer
    for offer in root.findall(".//offer"):
        ext_id = (offer.get("id") or "").strip()
        if not ext_id:
            continue

        fields: Dict[str, str] = {}
        for tag in ["name", "description_ua", "description", "vendorCode", "categoryId"]:
            el = offer.find(tag)
            if el is not None and el.text:
                fields[tag] = el.text

        yield ext_id, fields


def build_desc_by_external_id(xml_path: str, prefer_ua: bool = True) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for ext_id, fields in iter_offers(xml_path):
        raw = ""
        if prefer_ua and fields.get("description_ua"):
            raw = fields.get("description_ua") or ""
        elif fields.get("description"):
            raw = fields.get("description") or ""
        elif fields.get("description_ua"):
            raw = fields.get("description_ua") or ""

        cleaned = clean_horoshop_html_to_text(raw)
        if cleaned.strip():
            out[ext_id] = cleaned.strip()
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Update product descriptions in Postgres from Horoshop XML descriptions, "
            "keeping meaning but improving formatting (strip HTML, normalize bullets, drop boilerplate blocks)."
        )
    )
    ap.add_argument("--xml", required=True, help="Path to Horoshop XML file")
    ap.add_argument("--apply", action="store_true", help="Write updates to DB")
    ap.add_argument("--prefer-ua", action="store_true", help="Prefer <description_ua> when present")
    ap.add_argument("--dump-json", default="", help="Optional path to dump extracted descriptions mapping as JSON")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    desc_by_ext = build_desc_by_external_id(args.xml, prefer_ua=bool(args.prefer_ua))
    if args.dump_json:
        with open(args.dump_json, "w", encoding="utf-8") as f:
            json.dump(desc_by_ext, f, ensure_ascii=False, indent=2)

    conn = connect_postgres()
    with conn.cursor() as cur:
        cur.execute("SELECT id, external_id, description FROM products ORDER BY id")
        products = cur.fetchall()

    planned: List[Tuple[int, str]] = []
    for row in products:
        pid = int(row["id"]) if isinstance(row, dict) else int(row[0])
        ext_raw = (row.get("external_id") if isinstance(row, dict) else row[1]) or ""
        ext_ids = _split_external_ids(ext_raw)
        new_desc: Optional[str] = None
        for ext_id in ext_ids:
            if ext_id in desc_by_ext:
                new_desc = desc_by_ext[ext_id]
                break
        if not new_desc:
            continue

        current = (row.get("description") if isinstance(row, dict) else row[2]) or ""
        if (current or "").strip() == new_desc.strip():
            continue

        planned.append((pid, new_desc))
        if args.limit and len(planned) >= int(args.limit):
            break

    print(f"XML descriptions extracted: {len(desc_by_ext)}")
    print(f"Planned updates: {len(planned)} apply={bool(args.apply)}")
    if planned:
        pid0, d0 = planned[0]
        preview = d0.replace("\n", " ")
        print(f"Example id={pid0} len={len(d0)} preview={preview[:180]}{'...' if len(preview)>180 else ''}")

    if not args.apply:
        print("DRY RUN: no changes applied")
        return 0

    if not planned:
        print("No updates to apply")
        return 0

    with conn:
        with conn.cursor() as cur:
            for pid, new_desc in planned:
                cur.execute("UPDATE products SET description=%s WHERE id=%s", (new_desc, pid))

    print("OK: updates applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
