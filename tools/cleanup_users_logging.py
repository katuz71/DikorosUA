from pathlib import Path

p = Path("routers/users.py")
s = p.read_text(encoding="utf-8")

if "import logging\n" not in s:
    s = s.replace("import csv\n", "import csv\nimport logging\n")

if "logger = logging.getLogger(__name__)" not in s:
    s = s.replace("router = APIRouter()\n", "router = APIRouter()\nlogger = logging.getLogger(__name__)\n")

s = s.replace(
    '        print(f"📊 Updated {phone}: total_spent={total_spent} → cashback={cashback_percent}%")',
    '        logger.info("Updated cashback percent: phone=%s total_spent=%s cashback_percent=%s", phone, total_spent, cashback_percent)',
)

s = s.replace(
    '        print(f" Updated user info for {clean_phone}: email={info.email}, contact={info.contact_preference}")',
    '        logger.info("Updated user info: phone=%s email=%s contact=%s", clean_phone, info.email, info.contact_preference)',
)

p.write_text(s, encoding="utf-8")

print("OK: cleaned users logging")
