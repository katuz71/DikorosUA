from pathlib import Path

p = Path("routers/users.py")
s = p.read_text(encoding="utf-8")

start = s.find('@router.put("/api/user/info/{phone}")')
end = s.find('\n\n@router.post("/api/user/push-token")', start)

if start == -1:
    raise SystemExit("update_user_info start not found")
if end == -1:
    raise SystemExit("push-token marker not found")

new_block = '''@router.put("/api/user/info/{phone}")
def update_user_info(phone: str, info: UserInfoUpdate):
    """Оновлення профілю. phone у path може бути google_*/fb_* для соц. юзерів."""
    clean_phone = normalize_phone(phone)
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Invalid user identifier")

    conn = get_db_connection()
    try:
        cur = conn.cursor()

        if info.phone is not None and info.phone.strip():
            new_phone = "".join(filter(str.isdigit, info.phone.strip()))
            if not new_phone:
                raise HTTPException(status_code=400, detail="Invalid phone number")

            cur.execute("SELECT 1 FROM users WHERE phone = ?", (clean_phone,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")

            cur.execute("UPDATE users SET phone = ? WHERE phone = ?", (new_phone, clean_phone))
            conn.commit()
            clean_phone = new_phone

        update_fields = []
        update_values = []

        if info.name is not None:
            update_fields.append("name = ?")
            update_values.append(info.name)

        if info.city is not None:
            update_fields.append("city = ?")
            update_values.append(info.city)

        if info.warehouse is not None:
            update_fields.append("warehouse = ?")
            update_values.append(clean_warehouse_value(info.warehouse) or info.warehouse.strip())

        if getattr(info, "user_ukrposhta", None) is not None:
            update_fields.append("user_ukrposhta = ?")
            update_values.append(clean_warehouse_value(info.user_ukrposhta) or info.user_ukrposhta.strip())

        if info.email is not None:
            update_fields.append("email = ?")
            update_values.append(info.email)

        if info.contact_preference is not None:
            update_fields.append("contact_preference = ?")
            update_values.append(info.contact_preference)

        if update_fields:
            update_values.append(clean_phone)
            cur.execute(f"""
                UPDATE users
                SET {', '.join(update_fields)}
                WHERE phone = ?
            """, tuple(update_values))
            conn.commit()
            logger.info("Updated user info: phone=%s email=%s contact=%s", clean_phone, info.email, info.contact_preference)

        return {"status": "ok"}
    finally:
        conn.close()
'''

s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")

print("OK: update_user_info now closes DB connection with finally")
