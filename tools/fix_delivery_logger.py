from pathlib import Path

p = Path("routers/delivery.py")
s = p.read_text(encoding="utf-8")

if "logger = logging.getLogger(__name__)" not in s:
    s = s.replace(
        'router = APIRouter(prefix="/api/delivery", tags=["delivery"])\n',
        'router = APIRouter(prefix="/api/delivery", tags=["delivery"])\nlogger = logging.getLogger(__name__)\n',
    )

p.write_text(s, encoding="utf-8")

print("OK: added delivery logger")
