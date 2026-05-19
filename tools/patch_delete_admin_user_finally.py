from pathlib import Path

p = Path("routers/users.py")
s = p.read_text(encoding="utf-8")

start = s.find('@router.delete("/api/admin/user/{phone}")')
end = s.find('\n\n@router.post("/api/admin/users/delete-batch")', start)

if start == -1:
    raise SystemExit("delete_admin_user start not found")
if end == -1:
    raise SystemExit("delete_users_batch marker not found")

new_block = '''@router.delete("/api/admin/user/{phone}")
def delete_admin_user(phone: str):
    """Удаление клиента из базы (админ)."""
    clean_phone = normalize_phone(phone)
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Invalid phone")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE phone = ?", (clean_phone,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute("DELETE FROM users WHERE phone = ?", (clean_phone,))
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
'''

s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")

print("OK: delete_admin_user now closes DB connection with finally")
