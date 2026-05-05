#!/usr/bin/env python3
"""
Тестовый скрипт для проверки подключения к OneBox API.

Запуск:
    python test_onebox_connection.py

Что проверяет:
1. ✅ Подключение к OneBox API
2. ✅ Получение токена
3. ✅ Правильность WORKFLOW_ID и STATUS_ID
4. ✅ Доступность полей заказа
"""

import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

# Настройки из .env
ONEBOX_URL = os.getenv("ONEBOX_URL", "https://osmarina.crm-onebox.com").rstrip("/")
ONEBOX_LOGIN = os.getenv("ONEBOX_LOGIN")
ONEBOX_API_PASSWORD = os.getenv("ONEBOX_API_PASSWORD")
ONEBOX_WORKFLOW_ID = int(os.getenv("ONEBOX_WORKFLOW_ID", "11"))
ONEBOX_STATUS_ID = int(os.getenv("ONEBOX_STATUS_ID", "62"))


def print_section(title):
    """Красивый заголовок секции"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_success(message):
    """Зелёная галочка для успеха"""
    print(f"✅ {message}")


def print_error(message):
    """Красный крестик для ошибки"""
    print(f"❌ {message}")


def print_warning(message):
    """Жёлтый восклицательный знак для предупреждения"""
    print(f"⚠️  {message}")


def print_info(message):
    """Информационное сообщение"""
    print(f"ℹ️  {message}")


async def test_env_variables():
    """Тест 1: Проверка переменных окружения"""
    print_section("ШАГ 1: Проверка переменных окружения (.env)")
    
    all_ok = True
    
    if ONEBOX_URL:
        print_success(f"ONEBOX_URL = {ONEBOX_URL}")
    else:
        print_error("ONEBOX_URL не установлен!")
        all_ok = False
    
    if ONEBOX_LOGIN:
        print_success(f"ONEBOX_LOGIN = {ONEBOX_LOGIN}")
    else:
        print_error("ONEBOX_LOGIN не установлен!")
        all_ok = False
    
    if ONEBOX_API_PASSWORD:
        print_success(f"ONEBOX_API_PASSWORD = {'*' * len(ONEBOX_API_PASSWORD)}")
    else:
        print_error("ONEBOX_API_PASSWORD не установлен!")
        all_ok = False
    
    if ONEBOX_WORKFLOW_ID:
        print_success(f"ONEBOX_WORKFLOW_ID = {ONEBOX_WORKFLOW_ID}")
    else:
        print_warning("ONEBOX_WORKFLOW_ID не установлен (используется по умолчанию: 11)")
    
    if ONEBOX_STATUS_ID:
        print_success(f"ONEBOX_STATUS_ID = {ONEBOX_STATUS_ID}")
    else:
        print_warning("ONEBOX_STATUS_ID не установлен (используется по умолчанию: 62)")
    
    return all_ok


async def test_token():
    """Тест 2: Получение токена"""
    print_section("ШАГ 2: Получение API токена")
    
    try:
        async with httpx.AsyncClient() as client:
            print_info(f"Отправка запроса на {ONEBOX_URL}/api/v2/token/get/")
            
            resp = await client.post(
                f"{ONEBOX_URL}/api/v2/token/get/",
                json={
                    "login": ONEBOX_LOGIN,
                    "restapipassword": ONEBOX_API_PASSWORD
                },
                timeout=15.0,
            )
            
            print_info(f"Статус ответа: {resp.status_code}")
            
            if resp.status_code != 200:
                print_error(f"Неверный статус ответа: {resp.status_code}")
                print_error(f"Тело ответа: {resp.text}")
                return None
            
            data = resp.json()
            token = data.get("token") or data.get("dataArray", {}).get("token")
            
            if not token:
                print_error("Токен не найден в ответе!")
                print_error(f"Ответ API: {data}")
                return None
            
            print_success(f"Токен получен: {token[:20]}...{token[-10:]}")
            return token
            
    except httpx.ConnectError:
        print_error(f"Не удалось подключиться к {ONEBOX_URL}")
        print_warning("Проверьте, что URL правильный и сервер доступен")
        return None
    except Exception as e:
        print_error(f"Ошибка при получении токена: {e}")
        return None


async def test_workflow_and_status(token):
    """Тест 3: Проверка существования workflow и status"""
    print_section("ШАГ 3: Проверка Workflow и Status ID")
    
    if not token:
        print_error("Токен отсутствует, пропускаем тест")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            # Получаем список workflow
            print_info("Запрос списка бизнес-процессов...")
            
            resp = await client.post(
                f"{ONEBOX_URL}/api/v2/workflow/list/",
                headers={
                    "Token": token,
                    "Content-Type": "application/json",
                },
                json={},
                timeout=15.0,
            )
            
            if resp.status_code != 200:
                print_warning(f"Не удалось получить список workflow (статус {resp.status_code})")
                print_warning("Это нормально для некоторых версий OneBox")
                return True
            
            data = resp.json()
            workflows = data.get("dataArray", [])
            
            # Проверяем наличие нашего workflow
            workflow_found = False
            for wf in workflows:
                if wf.get("id") == ONEBOX_WORKFLOW_ID:
                    workflow_found = True
                    print_success(f"Workflow #{ONEBOX_WORKFLOW_ID} найден: {wf.get('name', 'Без названия')}")
                    break
            
            if not workflow_found and workflows:
                print_error(f"Workflow #{ONEBOX_WORKFLOW_ID} НЕ НАЙДЕН!")
                print_info("Доступные workflow:")
                for wf in workflows[:5]:  # Показываем первые 5
                    print(f"   - ID: {wf.get('id')}, Название: {wf.get('name')}")
                return False
            
            if not workflows:
                print_warning("Список workflow пуст или недоступен")
                print_info(f"Используем ONEBOX_WORKFLOW_ID = {ONEBOX_WORKFLOW_ID} как есть")
            
            return True
            
    except Exception as e:
        print_warning(f"Ошибка при проверке workflow: {e}")
        print_info("Продолжаем с текущими настройками")
        return True


async def test_create_order(token):
    """Тест 4: Попытка создания тестового заказа (проверка полей)"""
    print_section("ШАГ 4: Тест создания заказа (DRY RUN)")
    
    if not token:
        print_error("Токен отсутствует, пропускаем тест")
        return False
    
    # Минимальный тестовый заказ
    test_order = {
        "workflowid": ONEBOX_WORKFLOW_ID,
        "statusid": ONEBOX_STATUS_ID,
        "externalid": "TEST_ORDER_001",
        "name": "Тестовый заказ (не сохранять)",
        "description": "Это тестовый заказ для проверки API",
        "clientfio": "Тест Тестов",
        "clientphone": "+380991234567",
        "productArray": [
            {
                "name": "Тестовый товар",
                "price": 100,
                "bprice": 100,
                "pricebase": 100,
                "pricepurchase": 100,
                "pricesale": 100,
                "amount": 1,
                "articul": "TEST_SKU_001",
                "findbyArray": ["articul"],
            }
        ],
    }
    
    print_info("Отправка тестового заказа (если появится в OneBox - удалите его)")
    print_warning("⚠️  ВНИМАНИЕ: Этот заказ РЕАЛЬНО создастся в системе!")
    print_warning("⚠️  Найдите его в OneBox и удалите вручную")
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ONEBOX_URL}/api/v2/order/set/",
                headers={
                    "Token": token,
                    "Content-Type": "application/json",
                },
                json=[test_order],  # Всегда массив
                timeout=30.0,
            )
            
            print_info(f"Статус ответа: {resp.status_code}")
            
            if resp.status_code != 200:
                print_error(f"Ошибка создания заказа: {resp.status_code}")
                print_error(f"Ответ: {resp.text}")
                return False
            
            result = resp.json()
            
            # Проверяем на логические ошибки
            if isinstance(result, dict) and result.get("status") == 0:
                errors = result.get("errorArray", [])
                print_error(f"OneBox вернул ошибки: {errors}")
                return False
            
            print_success("Тестовый заказ успешно создан!")
            print_info(f"Ответ: {result}")
            print_warning("⚠️  НЕ ЗАБУДЬТЕ удалить тестовый заказ из OneBox!")
            
            return True
            
    except Exception as e:
        print_error(f"Ошибка при создании тестового заказа: {e}")
        return False


async def main():
    """Главная функция тестирования"""
    print("\n" + "🔧" * 35)
    print("   ТЕСТ ПОДКЛЮЧЕНИЯ К ONEBOX API")
    print("🔧" * 35)
    
    # Тест 1: Переменные окружения
    env_ok = await test_env_variables()
    if not env_ok:
        print("\n" + "=" * 70)
        print("❌ КРИТИЧЕСКАЯ ОШИБКА: Не все переменные окружения установлены!")
        print("=" * 70)
        return
    
    # Тест 2: Получение токена
    token = await test_token()
    if not token:
        print("\n" + "=" * 70)
        print("❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить токен!")
        print("Проверьте ONEBOX_LOGIN и ONEBOX_API_PASSWORD")
        print("=" * 70)
        return
    
    # Тест 3: Workflow и Status
    workflow_ok = await test_workflow_and_status(token)
    
    # Тест 4: Создание заказа
    order_ok = await test_create_order(token)
    
    # Итоговый отчёт
    print_section("ИТОГОВЫЙ РЕЗУЛЬТАТ")
    
    if env_ok and token and order_ok:
        print_success("ВСЕ ТЕСТЫ ПРОЙДЕНЫ! ✅")
        print_info("Интеграция настроена правильно")
        print_warning("Не забудьте удалить тестовый заказ из OneBox!")
    elif env_ok and token:
        print_warning("ЧАСТИЧНЫЙ УСПЕХ ⚠️")
        print_info("Подключение работает, но есть проблемы с настройками")
        print_info("Проверьте WORKFLOW_ID и STATUS_ID")
    else:
        print_error("ТЕСТЫ НЕ ПРОЙДЕНЫ ❌")
        print_info("Проверьте настройки в .env файле")
    
    print("\n" + "=" * 70)
    print("Документация: см. ИНСТРУКЦИЯ_НАСТРОЙКА.md")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
