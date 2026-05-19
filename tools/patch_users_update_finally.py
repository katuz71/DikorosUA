from pathlib import Path

p = Path("routers/users.py")
s = p.read_text(encoding="utf-8")

start = s.find('@router.put("/api/users/{phone}")')
end = s.find('\n\n@router.delete("/api/admin/user/{phone}")', start)

if start == -1:
    raise SystemExit("update_user start not found")
if end == -1:
    raise SystemExit("delete_admin_user marker not found")

new_block = '''@router.put("/api/users/{phone}")
def update_user(phone: str, u: AdminUserUpdate):
    """Обновление клиента админом: phone, name, city, warehouse, email, contact_preference, bonus_balance, total_spent."""
    clean_phone = normalize_phone(phone)
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Invalid phone")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE phone = ?", (clean_phone,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        new_phone = None
        if u.phone is not None and str(u.phone).strip():
            new_phone = "".join(filter(str.isdigit, str(u.phone).strip()))
            if not new_phone:
                raise HTTPException(status_code=400, detail="Invalid new phone number")
            if new_phone == clean_phone:
                new_phone = None

        update_fields = []
        update_values = []

        if u.name is not None:
            update_fields.append("name = ?")
            update_values.append(u.name)
        if u.city is not None:
            update_fields.append("city = ?")
            update_values.append(u.city)
        if u.warehouse is not None:
            update_fields.append("warehouse = ?")
            update_values.append(clean_warehouse_value(u.warehouse) or u.warehouse.strip())
        if getattr(u, "user_ukrposhta", None) is not None:
            update_fields.append("user_ukrposhta = ?")
            update_values.append(clean_warehouse_value(u.user_ukrposhta) or u.user_ukrposhta.strip())
        if u.email is not None:
            update_fields.append("email = ?")
            update_values.append(u.email)
        if u.contact_preference is not None:
            update_fields.append("contact_preference = ?")
            update_values.append(u.contact_preference)
        if u.bonus_balance is not None:
            update_fields.append("bonus_balance = ?")
            update_values.append(u.bonus_balance)
        if u.total_spent is not None:
            update_fields.append("total_spent = ?")
            update_values.append(u.total_spent)

        if update_fields:
            update_values.append(clean_phone)
            cur.execute(
                f"UPDATE users SET {', '.join(update_fields)} WHERE phone = ?",
                tuple(update_values),
            )
            conn.commit()

        if new_phone:
            cur.execute("UPDATE users SET phone = ? WHERE phone = ?", (new_phone, clean_phone))
            conn.commit()

        return {"status": "ok"}
    finally:
        conn.close()
'''

s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")

print("OK: update_user now closes DB connection with finally")
