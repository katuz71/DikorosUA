"""User-related helpers for the FastAPI backend."""

from __future__ import annotations

import re
from typing import Optional


def clean_warehouse_value(value: Optional[str]) -> Optional[str]:
    """Remove delivery provider prefixes before storing warehouse/address values."""
    if not value or not isinstance(value, str):
        return value
    cleaned = value.strip()
    for prefix in ("Нова Пошта:", "Нова почта:", "Нова Пошта：", "Укрпошта:", "Укрпочта:"):
        if cleaned.lower().startswith(prefix.rstrip(":").lower()):
            cleaned = cleaned[len(prefix) :].strip()
            break
    cleaned = re.sub(r"\s*Нова\s+[Пп]очта\s*:?\s*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"\s*Укрпошта\s*:?\s*", "", cleaned, flags=re.I).strip()
    return cleaned if cleaned else None


def normalize_phone(phone: str) -> str:
    """Normalize phone/auth identifier while preserving social auth technical IDs."""
    value = str(phone).strip()
    if value.startswith("google_") or value.startswith("fb_") or value.startswith("tg_"):
        return value
    return "".join(filter(str.isdigit, value))


def calculate_cashback_percent(total_spent: float) -> int:
    """Calculate cashback percent from lifetime spend."""
    if total_spent < 2000:
        return 0
    if total_spent < 5000:
        return 5
    if total_spent < 10000:
        return 10
    if total_spent < 25000:
        return 15
    return 20
