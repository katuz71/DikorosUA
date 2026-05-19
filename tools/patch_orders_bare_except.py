from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

old = '''        try: d["items"] = json.loads(d["items"])
        except: d["items"] = []
'''

new = '''        try:
            d["items"] = json.loads(d["items"])
        except (json.JSONDecodeError, TypeError, KeyError):
            d["items"] = []
'''

if old not in s:
    raise SystemExit("client order items json block not found")

s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

print("OK: replaced bare except in client orders")
