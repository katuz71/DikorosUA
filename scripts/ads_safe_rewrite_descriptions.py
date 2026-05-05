#!/usr/bin/env python3
import argparse
import html as _html
import os
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")

# Broad but practical: remove explicit medical / disease / treatment claims and dosing instructions.
_MEDICAL_RE = re.compile(
    r"(лікуван|лiкуван|лечен|профілакт|профилакти|захворюван|болезн|симптом|діагноз|диагноз|"
    r"протирак|протипухлин|антипухлин|пухлин|раков|онко|"
    r"противірус|противирус|антибактер|антибіот|антибиот|"
    r"імуномодул|імунн|иммун|"
    r"холестерин|тиск|давлен|серцево|сердечн|судин|"
    r"алергі|аллерг|"
    r"депрес|тривож|сон\b|безсон|стрес|"
    r"тестостерон|передміхур|простати?)",
    re.IGNORECASE,
)

_DOSING_RE = re.compile(
    r"(\bдоз(а|и|ування)?\b|мікродоз|micro\s*dose|\bmg\b|\bмг\b|\bг\b\s*/\s*д(ень|оба)|раз(и|ів)\s+на\s+д(ень|оба)|"
    r"приймат(и|ь)\s+по\s+\d|в\s+якості\s+дієтичн|дієтичн(ої|ой)\s+добавк)",
    re.IGNORECASE,
)

# Amanita/mushroom microdosing sensitivity.
_SENSITIVE_RE = re.compile(r"(мухомор|amanita|pantherina|muscaria|iboten|muscimol|мікродоз)", re.IGNORECASE)

# Boilerplate/links that are not product-specific.
_NOISE_RE = re.compile(
    r"(ТУ\s*ТУ\s*У|сертифікат|сертификат|sertifik|poshyreni\s*pytannia|mizhnarodni\s*vidpravky|"
    r"Більше\s+інформац|додаткових\s+питань|ознайомтеся\s+з\s+умовами|http[s]?://)",
    re.IGNORECASE,
)

_EXISTING_FOOTER_RE = re.compile(
    r"^(Важливо\s*:|\-\s*Опис\s+має\s+інформаційний\s+характер|\-\s*Не\s+є\s+лікарським\s+засобом|\-\s*Орієнтуйтесь\s+на\s+маркування)",
    re.IGNORECASE,
)

# Ad-policy sensitive drug-related wording (even when informational).
_DRUG_POLICY_RE = re.compile(
    r"(\bthc\b|тетрагідроканабінол|tetrahydrocannabinol|марихуан|psychoactive|психоактив)",
    re.IGNORECASE,
)


_HEADER_RE = re.compile(
    r"^(властивості|корисні\s+властивості|склад|опис|застосування|протипоказання|показання)\s*:?\s*$",
    re.IGNORECASE,
)


def _postprocess_formatting(lines: List[str]) -> List[str]:
    """Pure formatting pass:
    - drop orphan headers like 'Властивості:' when there is no content under them
    - turn simple lists under a ':' line into '- ' bullets
    """

    # 1) Drop orphan headers
    out: List[str] = []
    i = 0
    while i < len(lines):
        line = (lines[i] or "").strip()
        if _HEADER_RE.match(line):
            # Look ahead for actual content until next blank
            j = i + 1
            has_content = False
            while j < len(lines):
                nxt = (lines[j] or "").strip()
                if not nxt:
                    break
                if _HEADER_RE.match(nxt):
                    break
                has_content = True
                break
            if not has_content:
                i += 1
                continue
        out.append(lines[i])
        i += 1

    # 2) Convert simple post-colon lists to bullets
    out2: List[str] = []
    i = 0
    while i < len(out):
        line = (out[i] or "").strip()
        out2.append(out[i])
        if line.endswith(":") and line and not line.startswith("-"):
            j = i + 1
            # Only bulletize short, list-like consecutive lines
            while j < len(out):
                nxt_raw = out[j]
                nxt = (nxt_raw or "").strip()
                if not nxt:
                    break
                if nxt.startswith("-"):
                    break
                # If it looks like a sentence, keep as-is
                if len(nxt) > 90 or "." in nxt or "!" in nxt or "?" in nxt:
                    break
                out2.append("- " + nxt.lstrip("-–— "))
                j += 1
            i = j
            continue
        i += 1

    # Collapse blank lines again
    collapsed: List[str] = []
    prev_blank = False
    for l in out2:
        blank = not (l or "").strip()
        if blank and prev_blank:
            continue
        collapsed.append(l)
        prev_blank = blank
    return collapsed


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    if v is None:
        return default
    v = v.strip()
    return v if v else default


def connect_postgres():
    database_url = _env("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def _clean_spaces(text: str) -> str:
    return _WS_RE.sub(" ", (text or "").replace("\u00a0", " ")).strip()


def _strip_html(text: str) -> str:
    if not text:
        return ""
    t = _html.unescape(text)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"<\s*br\s*/?\s*>", "\n", t, flags=re.IGNORECASE)
    t = re.sub(r"<\s*/\s*p\s*>", "\n", t, flags=re.IGNORECASE)
    t = re.sub(r"<\s*p\b[^>]*>", "", t, flags=re.IGNORECASE)
    # Basic list support
    t = re.sub(r"<\s*li\b[^>]*>", "\n- ", t, flags=re.IGNORECASE)
    t = re.sub(r"<\s*/\s*li\s*>", "", t, flags=re.IGNORECASE)
    t = re.sub(r"<\s*/?\s*ul\b[^>]*>", "\n", t, flags=re.IGNORECASE)
    t = _TAG_RE.sub(" ", t)

    # Fix common broken wraps in numeric values from legacy sources: "0,\n35" -> "0,35"
    t = re.sub(r"(\d)\s*,\s*\n\s*(\d)", r"\1,\2", t)
    t = re.sub(r"(\d)\s*\.\s*\n\s*(\d)", r"\1.\2", t)
    lines = [_clean_spaces(x) for x in t.split("\n")]
    # Normalize pseudo bullets
    out: List[str] = []
    for line in lines:
        if not line:
            out.append("")
            continue
        if re.match(r"^[•\u2022\u25CF\u25AA\u25E6]\s+", line):
            line = "- " + re.sub(r"^[•\u2022\u25CF\u25AA\u25E6]\s+", "", line)
        if re.match(r"^[-–—]\s*\S", line) and not line.startswith("- "):
            line = "- " + re.sub(r"^[-–—]\s*", "", line)
        out.append(line)

    # Collapse blank lines
    collapsed: List[str] = []
    prev_blank = False
    for line in out:
        blank = not line.strip()
        if blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = blank

    return "\n".join(collapsed).strip()


def _is_sensitive(name: str, category: str, desc: str) -> bool:
    blob = f"{name or ''} {category or ''} {desc or ''}"
    return bool(_SENSITIVE_RE.search(blob))


def _should_drop_fragment(text: str, sensitive: bool) -> bool:
    if not text.strip():
        return False
    if _DRUG_POLICY_RE.search(text):
        return True
    if _DOSING_RE.search(text):
        return True
    if _MEDICAL_RE.search(text):
        return True
    if sensitive and re.search(
        r"активн\w*\s+речовин|потужн\w*\s+вплив|вищ\w*\s+концентрац",
        text,
        flags=re.IGNORECASE,
    ):
        return True
    return False


def _split_sentences(text: str) -> List[str]:
    # Very lightweight splitter: good enough for removing whole claim-sentences
    # without rewriting the rest.
    t = (text or "").strip()
    if not t:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\s*;\s+", t)
    out: List[str] = []
    for p in parts:
        s = p.strip()
        if s:
            out.append(s)
    return out


def rewrite_description_ads_safe(desc: str, name: str = "", category: str = "") -> str:
    # Minimal, non-inventive cleaning:
    # - keep the original text as base
    # - normalize HTML/bullets/whitespace
    # - remove only explicit medical/dosing/drug-policy fragments (“жесть”)
    # - do NOT add any templates/footers/extra sections
    base = _strip_html(desc)
    if not base:
        return ""

    sensitive = _is_sensitive(name, category, base)

    out_lines: List[str] = []
    for raw in base.split("\n"):
        s = (raw or "").strip()
        if not s:
            out_lines.append("")
            continue

        if _NOISE_RE.search(s):
            continue
        if _EXISTING_FOOTER_RE.search(s):
            continue
        if s.lower() in {".", "…"}:
            continue
        if re.fullmatch(r"https?://\S+", s, flags=re.IGNORECASE):
            continue

        # Bullet line: keep as-is unless it contains a forbidden fragment
        if s.startswith("-"):
            bullet = "- " + s.lstrip("-–— ")
            if _should_drop_fragment(bullet, sensitive):
                continue
            out_lines.append(_clean_spaces(bullet))
            continue

        # Paragraph line: remove only the sentences that contain forbidden fragments
        kept: List[str] = []
        for sent in _split_sentences(s):
            if _should_drop_fragment(sent, sensitive):
                continue
            kept.append(sent)

        if not kept:
            continue

        out_lines.append(_clean_spaces(" ".join(kept)))

    # Collapse blank lines
    collapsed: List[str] = []
    prev_blank = False
    for line in out_lines:
        blank = not line.strip()
        if blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = blank

    collapsed = _postprocess_formatting(collapsed)

    return "\n".join(collapsed).strip()


def iter_products(conn) -> Iterable[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, category, description FROM products ORDER BY id")
        for row in cur.fetchall():
            yield dict(row)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Minimal ads-safe cleanup for existing descriptions in Postgres (formatting + remove explicit medical/dosing/drug-policy fragments; no templates)."
    )
    ap.add_argument("--apply", action="store_true", help="Write updates to DB")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only-ids", default="", help="Comma-separated product ids to process")
    args = ap.parse_args()

    only_ids: Optional[set[int]] = None
    if args.only_ids.strip():
        only_ids = set()
        for p in args.only_ids.split(","):
            p = p.strip()
            if p.isdigit():
                only_ids.add(int(p))

    conn = connect_postgres()
    planned: List[Tuple[int, str, str]] = []  # (id, old_preview, new_preview)
    updates: List[Tuple[int, str]] = []

    for row in iter_products(conn):
        pid = int(row["id"])
        if only_ids is not None and pid not in only_ids:
            continue

        current = (row.get("description") or "").strip()
        if not current:
            continue

        new_desc = rewrite_description_ads_safe(current, name=row.get("name") or "", category=row.get("category") or "")
        if not new_desc:
            continue

        if new_desc.strip() == current.strip():
            continue

        updates.append((pid, new_desc))
        planned.append((pid, current[:160].replace("\n", " "), new_desc[:160].replace("\n", " ")))

        if args.limit and len(updates) >= int(args.limit):
            break

    print(f"Planned updates: {len(updates)} apply={bool(args.apply)}")
    if planned:
        print("Examples (first 3):")
        for pid, old_p, new_p in planned[:3]:
            print(f"- id={pid}\n  old: {old_p}{'...' if len(old_p)==160 else ''}\n  new: {new_p}{'...' if len(new_p)==160 else ''}")

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

    print("OK: updates applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
