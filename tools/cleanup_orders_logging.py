from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

if "import logging\n" not in s:
    s = s.replace("import csv\n", "import csv\nimport logging\n")

if "logger = logging.getLogger(__name__)" not in s:
    s = s.replace("router = APIRouter()\n", "router = APIRouter()\nlogger = logging.getLogger(__name__)\n")

replacements = {
    '            print(f"✅ Создан новый пользователь: {user_phone}")':
        '            logger.info("Created new user: %s", user_phone)',

    '            print(f"📧 Обновлен профиль пользователя: name={order.name}, city={order.city}, warehouse={order.warehouse}, email={order.email}, contact={order.contact_preference}")':
        '            logger.info("Updated user profile: phone=%s", user_phone)',

    '            print(f"💳 Списано бонусов: {order.bonus_used} ₴ для {user_phone} (оплата при отриманні)")':
        '            logger.info("Bonuses deducted for cash order: phone=%s amount=%s", user_phone, order.bonus_used)',

    '        print(f"✅ Заказ #{order_id} создан успешно")':
        '        logger.info("Order created successfully: order_id=%s", order_id)',

    '                            print(f"✅ Монобанк: інвойс створено для замовлення #{order_id}, pageUrl отримано")':
        '                            logger.info("Monobank invoice created: order_id=%s", order_id)',

    '                            print(f"⚠️ Монобанк: відповідь без pageUrl: {mono_data}")':
        '                            logger.warning("Monobank response without pageUrl: %s", mono_data)',

    '                    print(f"⚠️ Помилка запиту до Монобанка: {mono_err}")':
        '                    logger.warning("Monobank request failed: %s", mono_err)',

    '                print("⚠️ MONOBANK_API_TOKEN не задано, pageUrl не створено")':
        '                logger.warning("MONOBANK_API_TOKEN is not set, payment URL was not created")',

    '        print(f"❌ Ошибка создания заказа: {e}")':
        '        logger.exception("Failed to create order")',

    '                print(f"💳 Списано бонусов: {bonus_used} ₴ для {user_phone} (оплата картою підтверджена)")':
        '                logger.info("Bonuses deducted after card payment: phone=%s amount=%s", user_phone, bonus_used)',

    '    print(f"✅ Платіж Монобанка: замовлення #{order_id} оновлено на «Оплачено»")':
        '    logger.info("Monobank payment confirmed: order_id=%s", order_id)',

    '                print(f"💰 [Cashback] Заказ #{id} завершен:")':
        '                logger.info("Cashback applied: order_id=%s user_phone=%s order_total=%s cashback_amount=%s new_bonus_balance=%s", id, user_phone, order_total, cashback_amount, new_bonus_balance)',

    '                print(f"   Пользователь: {user_phone}")':
        '',

    '                print(f"   Сумма заказа: {order_total} ₴")':
        '',

    '                print(f"   Общая сумма покупок: {current_total_spent} → {new_total_spent} ₴")':
        '',

    '                print(f"   Процент кешбэка за заказ: {cashback_percent_for_order}%")':
        '',

    '                print(f"   Новый уровень кешбэка: {new_cashback_percent}%")':
        '',

    '                print(f"   Начислено бонусов: {cashback_amount} ₴")':
        '',

    '                print(f"   Баланс бонусов: {current_bonus} → {new_bonus_balance} ₴")':
        '',

    '    print(f"🔍 Searching orders for phone: {phone} -> {clean_phone}")':
        '    logger.info("Searching client orders: phone=%s", clean_phone)',

    '    print(f"✅ Found {len(rows)} orders for {clean_phone}")':
        '    logger.info("Found client orders: phone=%s count=%s", clean_phone, len(rows))',
}

for old, new in replacements.items():
    if old in s:
        s = s.replace(old, new)

# Убираем пустые строки с одними пробелами после удаления cashback print-строк
lines = [line for line in s.splitlines() if line.strip() != "" or True]
s = "\n".join(s.splitlines()) + "\n"

p.write_text(s, encoding="utf-8")

print("OK: cleaned orders logging")
