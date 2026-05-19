from pathlib import Path

p = Path("routers/users.py")
s = p.read_text(encoding="utf-8")

start = s.find('@router.post("/api/user/push-token")')
end = len(s)

if start == -1:
    raise SystemExit("save_push_token start not found")

new_block = '''@router.post("/api/user/push-token")
def save_push_token(body: PushTokenRequest, background_tasks: BackgroundTasks):
    """Зберігає push-токен для користувача за auth_id. Привітальний пуш тільки якщо клієнт передав send_welcome=True (після sign_up) і ще не надсилався."""
    auth_id = (body.auth_id or "").strip()
    token = (body.token or "").strip()

    if not auth_id or not token:
        raise HTTPException(status_code=400, detail="auth_id and token are required")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        row = cur.execute("SELECT push_token, welcome_push_sent FROM users WHERE phone = ?", (auth_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute("UPDATE users SET push_token = ? WHERE phone = ?", (token, auth_id))

        row_dict = dict(row)
        should_send_welcome = bool(getattr(body, "send_welcome", False)) and not row_dict.get("welcome_push_sent")

        if should_send_welcome and token.startswith("ExponentPushToken"):
            cur.execute("UPDATE users SET welcome_push_sent = 1 WHERE phone = ?", (auth_id,))
            background_tasks.add_task(
                send_expo_push,
                token,
                "Вітаємо у DikorosUA 🍄",
                "Дякуємо за реєстрацію! Ваш бонус уже чекає у профілі.",
            )

        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()
'''

s = s[:start] + new_block
p.write_text(s, encoding="utf-8")

print("OK: save_push_token now closes DB connection with finally")
