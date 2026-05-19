from pathlib import Path

p = Path("main.py")
s = p.read_text(encoding="utf-8")

old = '''    # Создаем admin.html из строки только если его нет
    # Это позволяет вручную обновлять admin.html без перезаписи
    # if not os.path.exists("admin.html"):
    #     with open("admin.html", "w", encoding="utf-8") as f:
    #         f.write(ADMIN_HTML_CONTENT)
'''

new = ""

if old not in s:
    raise SystemExit("old admin fallback comment block not found")

s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

print("OK: removed stale ADMIN_HTML_CONTENT comments")
