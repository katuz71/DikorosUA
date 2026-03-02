import requests
import json

def send_push_notification():
    URL = "https://exp.host/--/api/v2/push/send"
    
    # ТВОЙ НОВЫЙ ТОКЕН
    EXPO_TOKEN = "ExponentPushToken[HsT31iPdO-vuQtqYOMp00m]"
    
    # Твои проверенные данные
    OWNER = "dikorosua"
    SLUG = "dikorosua"
    PROJECT_ID = "66618f31-dc39-46f1-ba09-55c52d037f4a"

    payload = {
        "to": EXPO_TOKEN,
        "title": "Dikoros UA 🍄",
        "body": "Билд обновлен, токен свежий. Летим!",
        "sound": "default",
        "priority": "high",
        "channelId": "default",
        "projectId": PROJECT_ID,
        "experienceId": f"@{OWNER}/{SLUG}",
        "data": {"status": "success_after_build"},
        "_displayInForeground": True
    }

    print(f"--- ТЕСТ С НОВЫМ ТОКЕНОМ ---")
    try:
        r = requests.post(URL, json=payload)
        res = r.json()
        print(f"Статус: {r.status_code}")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        
        # Если в ответе ошибка "DeviceNotRegistered", значит нужно еще раз 
        # нажать "Перерегистрировать пуши" в приложении.
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    send_push_notification()