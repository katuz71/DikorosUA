from pathlib import Path

main_path = Path("main.py")
main = main_path.read_text(encoding="utf-8")

start_marker = "Base = declarative_base()"
end_marker = "# --- НАСТРОЙКИ ---"

start = main.find(start_marker)
end = main.find(end_marker)

if start == -1:
    raise SystemExit("Base/model block start not found")
if end == -1:
    raise SystemExit("settings marker not found")
if end <= start:
    raise SystemExit("Invalid model block range")

new_main = main[:start].rstrip() + "\n\n" + main[end:]

# Clean SQLAlchemy imports now unused
new_main = new_main.replace("from sqlalchemy import Boolean, Column, Float, Integer, String, Text\n", "")
new_main = new_main.replace("from sqlalchemy.ext.declarative import declarative_base\n", "")

main_path.write_text(new_main, encoding="utf-8")

print("OK: removed legacy SQLAlchemy models from main.py")
