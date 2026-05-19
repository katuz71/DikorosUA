from pathlib import Path

p = Path("routers/chat.py")
s = p.read_text(encoding="utf-8")

s = s.replace('            print(f"DEBUG GPT RESPONSE: {response_text}")\n', "")

if "import logging\n" not in s:
    s = s.replace("import json\n", "import json\nimport logging\n")

if "logger = logging.getLogger(__name__)" not in s:
    s = s.replace("router = APIRouter()\n", "router = APIRouter()\nlogger = logging.getLogger(__name__)\n")

s = s.replace('        print(f"CHAT ERROR: {e}")', '        logger.exception("CHAT ERROR")')

p.write_text(s, encoding="utf-8")

print("OK: cleaned chat debug prints")
