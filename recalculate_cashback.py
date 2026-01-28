import sqlite3

def calculate_cashback_percent(total_spent: float) -> int:
    """
    Расчет процента кешбэка на основе общей суммы покупок
    """
    if total_spent < 2000:
        return 0
    elif total_spent < 5000:
        return 5
    elif total_spent < 10000:
        return 10
    elif total_spent < 25000:
        return 15
    else:
        return 20

# Подключаемся к БД
conn = sqlite3.connect('shop.db')
cur = conn.cursor()

# Получаем всех пользователей
users = cur.execute("SELECT phone, total_spent, cashback_percent FROM users").fetchall()

print(f"📊 Найдено пользователей: {len(users)}\n")

# Обновляем процент кешбэка для каждого
for user in users:
    phone = user[0]
    total_spent = user[1] or 0
    old_percent = user[2] or 0
    new_percent = calculate_cashback_percent(total_spent)
    
    if old_percent != new_percent:
        cur.execute("UPDATE users SET cashback_percent=? WHERE phone=?", (new_percent, phone))
        print(f"✅ {phone}: total_spent={total_spent}₴ | {old_percent}% → {new_percent}%")
    else:
        print(f"⏭️  {phone}: total_spent={total_spent}₴ | {new_percent}% (без изменений)")

conn.commit()
conn.close()

print(f"\n🎉 Пересчет завершен!")
