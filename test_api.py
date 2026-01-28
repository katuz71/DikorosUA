import requests

# ТВОИ ДАННЫЕ
ONEBOX_DOMAIN = "dikoros.1b.app"
ONEBOX_LOGIN = "roma.ozivskij@gmail.com"
# Сюда вставь ТОЛЬКО ЧТО сгенерированный пароль
ONEBOX_PASSWORD = "8cda78e626e22a2a3600a3302e31333134323530302031373639353338373833" 

url = f"https://{ONEBOX_DOMAIN}/api/v2/token/get/"
payload = {
    "login": ONEBOX_LOGIN,
    "password": ONEBOX_PASSWORD
}

try:
    print(f"📡 Стучимся в {url}...")
    response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})
    print(f"Код ответа: {response.status_code}")
    print(f"Тело ответа: {response.text}")
    
    if "userauthtoken" in response.text:
        print("\n✅ УРА! Токен получен. Можно возвращать пароль в main.py и работать.")
    else:
        print("\n❌ Всё еще нет прав. Проверяй настройки группы.")
except Exception as e:
    print(f"Ошибка: {e}")