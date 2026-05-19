from pathlib import Path

p = Path("services/security.py")
s = p.read_text(encoding="utf-8")

start = s.find('def require_admin(')
end = s.find('\ndef _method_set', start)

if start == -1:
    raise SystemExit("require_admin start not found")
if end == -1:
    raise SystemExit("_method_set marker not found")

new_require_admin = '''def require_admin(x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")) -> bool:
    """Require a server-side admin key for administrative API endpoints."""
    expected_key = os.getenv("ADMIN_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=403, detail="Admin API is disabled")
    if not x_admin_key or not hmac.compare_digest(str(x_admin_key), str(expected_key)):
        raise HTTPException(status_code=403, detail="Forbidden")
    return True
'''

s = s[:start] + new_require_admin + s[end:]

s = s.replace(
    "_ROUTE_GUARD_INSTALLED = True\ndef add_admin_guard_middleware",
    "_ROUTE_GUARD_INSTALLED = True\n\n\ndef add_admin_guard_middleware",
)

p.write_text(s, encoding="utf-8")
print("OK: fixed require_admin")
