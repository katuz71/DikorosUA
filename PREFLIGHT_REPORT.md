# Pre-flight checklist: продакшен AAB для Google Play

**Дата:** 3 марта 2025  
**Цель:** Сборка боевого `.aab` (Android App Bundle) для публикации в Google Play.

---

## 1. Интеграция Apix-Drive (OneBox) в бэкенде (`main.py`)

### Где отправляются данные заказа в Apix-Drive
- **Функция:** `send_to_apix_drive(order_data: dict)` (строка ~233).
- **Вызов:** после создания заказа в `create_order` — в фоне через `background_tasks.add_task(send_to_apix_drive, order_data)` (строка ~3287).
- **Данные:** словарь `order_data` с полями `id`, `name` и др., подготовленный для OneBox (строка ~3264).

### Как передаётся URL Apix-Drive
- **Сейчас:** URL **захардкожен** в коде.
- **Переменная:** `APIX_DRIVE_WEBHOOK_URL = "https://s7.apix-drive.com/web-hooks/30463/bx226u6b"` (строка 209).
- **Рекомендация:** Вынести в `.env`, например `APIX_DRIVE_WEBHOOK_URL`, и читать через `os.getenv("APIX_DRIVE_WEBHOOK_URL")`, чтобы не хранить продакшен-вебхук в репозитории и иметь возможность менять его без правки кода.

### Вебхуки Монобанка — уход от ngrok
- **Статус:** от захардкоженных ссылок ngrok **уже ушли**.
- **Текущие значения (захардкожены в коде):**
  - `webHookUrl`: `"https://app.dikoros.ua/api/payment/callback"` (строка 3307).
  - `redirectUrl`: `order.return_url or "https://dikoros-ua.com"` (строка 3308).
- **Замечание:** Ссылки боевые (app.dikoros.ua, dikoros-ua.com), но не берутся из `PUBLIC_BASE_URL` / `.env`. Для гибкости лучше формировать из `os.getenv("PUBLIC_BASE_URL")` (уже есть в проекте).

**Итог по п.1:** Интеграция Apix-Drive и Монобанк работают на боевых доменах; рекомендуется перевести URL Apix-Drive и при желании webHook/redirect Монобанка на переменные окружения.

---

## 2. Настройки API в приложении (`config/api.ts`)

### Куда смотрит `API_URL`
- **Логика:** Сначала проверяется `process.env.EXPO_PUBLIC_API_URL`. Если задан — используется он.
- **Иначе:** используется константа `PROD_API_URL = 'https://app.dikoros.ua'` (строка 10).
- **Итог:** В продакшен-сборке без `EXPO_PUBLIC_API_URL` приложение идёт на **боевой домен** `https://app.dikoros.ua`. Локальный/ngrok не используется по умолчанию.

**Важно:** В `.env.example` указан `API_URL=http://localhost:8001` — это для бэкенда/локальной разработки. В Expo для приложения используется префикс `EXPO_PUBLIC_`, то есть переменная для клиента — `EXPO_PUBLIC_API_URL`. Если в EAS/локальном `.env` для сборки не задан `EXPO_PUBLIC_API_URL`, в билд попадёт дефолтный продакшен URL — это корректно для магазина.

**Итог по п.2:** Для продакшен AAB `API_URL` указывает на боевой домен; тестовые ссылки (localhost/ngrok) в дефолтной конфигурации не используются.

---

## 3. Версионирование и схемы (`app.json`)

### Версия и versionCode
- **version:** `"1.0.0"` (строка 6).
- **versionCode (Android):** `11` (строка 24).

### Scheme (deep link)
- **Текущее значение:** `"scheme": "com.dikorosua.app"` (строка 9).
- **Замечание:** Обычно `scheme` для глубоких ссылок делают коротким (например, `dikoros`), а `com.dikorosua.app` — это bundle identifier. Если в коде или на бэкенде ожидается именно `dikoros://`, нужно заменить на `"scheme": "dikoros"`. Если ссылки строятся как `com.dikorosua.app://` — текущее значение согласовано.

### Иконки и splash
- **icon:** `"./assets/images/icon.png"` (строка 8).
- **adaptiveIcon (Android):**
  - `foregroundImage`: `"./assets/images/android-icon-foreground.png"`.
  - `backgroundImage`: `"./assets/images/android-icon-background.png"`.
  - `backgroundColor`: `"#E8F5E9"`.
- **Splash:** В `app.json` отдельного поля `splash` (image/backgroundColor) **нет**. Используется пакет `expo-splash-screen` из зависимостей; при отсутствии конфига Expo может использовать дефолтный splash. Для явного вида при запуске стоит добавить в `app.json` блок `expo.splash` (image, backgroundColor, resizeMode).

**Рекомендация:** Убедиться, что в репозитории/артефактах сборки есть файлы:
- `./assets/images/icon.png`
- `./assets/images/android-icon-foreground.png`
- `./assets/images/android-icon-background.png`

**Итог по п.3:** Версия и versionCode заданы; иконки прописаны. Нужно подтвердить наличие файлов и при необходимости поправить `scheme` под ожидаемые deep link’ы и добавить `splash` в `app.json`.

---

## 4. Профиль сборки (`eas.json`)

### Профиль `production`
- **Настроен:** да.
- **Тип сборки Android:** `"buildType": "app-bundle"` (строка 12).
- **Итог:** Для команды вида `eas build --platform android --profile production` будет собираться именно **AAB** для Google Play, не APK.

**Итог по п.4:** Профиль продакшена настроен корректно для публикации в Google Play.

---

## Сводная таблица рисков

| Проверка | Статус | Критично для продакшена |
|----------|--------|---------------------------|
| Apix-Drive URL в коде | Захардкожен | Нет (рабочий URL) |
| Монобанк webHook/redirect | Боевые домены | Нет |
| API_URL в приложении | Боевой домен по умолчанию | Нет |
| Версия / versionCode | Заданы | — |
| Scheme | com.dikorosua.app (проверить под deep links) | Зависит от требований |
| Иконки в app.json | Пути указаны | Проверить наличие файлов |
| Splash в app.json | Не задан | Желательно добавить |
| EAS production → app-bundle | Да | Да |

---

## Рекомендации перед сборкой

1. **Опционально:** Вынести `APIX_DRIVE_WEBHOOK_URL` в `.env` и читать через `os.getenv`.
2. **Опционально:** Формировать `webHookUrl` и `redirectUrl` для Монобанка из `PUBLIC_BASE_URL`.
3. Убедиться, что в корне проекта при сборке **не** задан `EXPO_PUBLIC_API_URL` (или что он указывает на `https://app.dikoros.ua`), чтобы в AAB не попал тестовый URL.
4. Проверить наличие `./assets/images/icon.png`, `android-icon-foreground.png`, `android-icon-background.png`.
5. При необходимости: заменить `scheme` на `dikoros` и добавить блок `splash` в `app.json`.
6. **Дополнительно:** В `main.py` в эндпоинтах Нова Пошта используется fallback `os.getenv("NOVA_POSHTA_API_KEY", "a45ac6931c41c99d21e59da12d8438f5")`. Убедиться, что на продакшене задан свой `NOVA_POSHTA_API_KEY` в окружении, иначе будет использоваться этот ключ из кода (потенциально тестовый).

После выполнения пунктов 3–6 можно запускать продакшен-сборку:  
`eas build --platform android --profile production`.
