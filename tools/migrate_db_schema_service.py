from pathlib import Path

main_path = Path("main.py")
schema_path = Path("services/db_schema.py")

main = main_path.read_text(encoding="utf-8")

start_marker = "# --- БАЗА ДАННЫХ ---"
end_marker = "# --- APP ---"

start = main.find(start_marker)
end = main.find(end_marker)

if start == -1:
    raise SystemExit("DB schema block start not found")
if end == -1:
    raise SystemExit("APP marker not found")
if end <= start:
    raise SystemExit("Invalid DB schema block range")

schema_block = main[start:end].strip()

schema_content = '''"""Database schema initialization and lightweight migrations."""

from __future__ import annotations

from db import get_db_connection


''' + schema_block + "\n"

schema_path.write_text(schema_content, encoding="utf-8")

new_main = main[:start].rstrip() + "\n\n" + main[end:]

old_import = "from db import get_db_connection"
new_import = "from services.db_schema import fix_db_schema, init_db"

if old_import in new_main:
    new_main = new_main.replace(old_import, new_import)
elif new_import not in new_main:
    raise SystemExit("db import line not found")

main_path.write_text(new_main, encoding="utf-8")

print("OK: moved fix_db_schema to services/db_schema.py")
