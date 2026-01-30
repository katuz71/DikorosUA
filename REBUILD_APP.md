# Проблема: Приложение Использует Старую Сборку

Логи `initDatabase` не появляются, потому что приложение использует старую сборку кода, где этих логов еще нет.

## Решение: Пересборка Приложения

### Вариант 1: Быстрый (Development Build)

```bash
# Остановите текущий сервер (Ctrl+C)

# Пересоберите приложение
npx expo run:android
# или
npx expo run:ios

# После установки запустите Metro
npx expo start --dev-client
```

### Вариант 2: Полная Очистка

```bash
# 1. Удалите приложение с устройства/эмулятора

# 2. Очистите все кеши
npx expo start --clear
rm -rf .expo node_modules/.cache

# 3. Пересоберите
npx expo prebuild --clean
npx expo run:android  # или run:ios
```

## Альтернатива: Проверка БД Напрямую

Если пересборка займет много времени, можно проверить БД напрямую через скрипт:

```python
# check_app_db.py
import sqlite3
import os

# Путь к БД в приложении (нужно узнать из логов FileSystem.documentDirectory)
# Обычно это что-то вроде:
# Android: /data/data/com.yourapp/files/SQLite/dikoros_v12.db
# iOS: /var/mobile/Containers/Data/Application/.../Documents/SQLite/dikoros_v12.db

# Проверяем БД в assets
db_path = 'services/shop.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM products')
total = cursor.fetchone()[0]
print(f'Total products in services/shop.db: {total}')

cursor.execute('SELECT COUNT(*) FROM products WHERE id BETWEEN 349 AND 354')
new_count = cursor.fetchone()[0]
print(f'New variants (349-354): {new_count}')

if new_count == 6:
    print('✅ БД в assets правильная!')
    print('❌ Проблема: приложение не загружает новую БД из assets')
    print('   Решение: пересоберите приложение')
else:
    print('❌ БД в assets неправильная!')
    print('   Решение: проверьте что shop.db скопирована правильно')

conn.close()
```

## Почему Это Происходит

Expo Development Client кеширует нативный код и assets при первой сборке. Изменения в:
- `services/shop.db` (asset файл)
- Нативных модулях

Требуют **пересборки приложения**, а не просто перезагрузки Metro bundler.

## Быстрая Проверка

Если у вас есть доступ к файловой системе приложения, проверьте:

```bash
# Android
adb shell run-as com.yourapp ls -la files/SQLite/
adb shell run-as com.yourapp cat files/SQLite/dikoros_v12.db | wc -c

# Сравните размер с services/shop.db
ls -la services/shop.db
```

Если размеры разные - приложение использует старую БД.
