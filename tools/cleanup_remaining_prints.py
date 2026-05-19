from pathlib import Path

# services/analytics.py
p = Path("services/analytics.py")
s = p.read_text(encoding="utf-8")

if "import logging\n" not in s:
    s = s.replace("import os\n", "import logging\nimport os\n")

if "logger = logging.getLogger(__name__)" not in s:
    marker = "load_dotenv()\n"
    if marker in s:
        s = s.replace(marker, marker + "\nlogger = logging.getLogger(__name__)\n")
    else:
        s = s.replace("\n\n", "\n\nlogger = logging.getLogger(__name__)\n\n", 1)

s = s.replace(
    '            print(f"⚠️ FB CAPI Error: {exc}")',
    '            logger.warning("FB CAPI Error: %s", exc)',
)
s = s.replace(
    '            print(f"⚠️ GA4 Error: {exc}")',
    '            logger.warning("GA4 Error: %s", exc)',
)

p.write_text(s, encoding="utf-8")

# main.py
p = Path("main.py")
s = p.read_text(encoding="utf-8")
s = s.replace(
    '    print("✅ Server started successfully")',
    '    logger.info("Server started successfully")',
)
p.write_text(s, encoding="utf-8")

print("OK: cleaned remaining print statements")
