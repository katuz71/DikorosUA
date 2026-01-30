# Как Прочитать Лог Инициализации БД

Логи инициализации БД теперь сохраняются в файл для анализа.

## Где Находится Файл

Файл лога: `db_init_log.txt` в директории приложения.

## Как Прочитать

### Вариант 1: Через Expo DevTools

1. Откройте приложение
2. Встряхните устройство или нажмите `Cmd+D` (iOS) / `Cmd+M` (Android)
3. Выберите "Debug Remote JS"
4. В консоли браузера выполните:
```javascript
FileSystem.readAsStringAsync(FileSystem.documentDirectory + 'db_init_log.txt')
  .then(content => console.log(content))
```

### Вариант 2: Добавить Кнопку в UI

Добавьте временную кнопку в приложение:

```typescript
import * as FileSystem from 'expo-file-system';

<Button 
  title="Показать лог БД" 
  onPress={async () => {
    const log = await FileSystem.readAsStringAsync(
      FileSystem.documentDirectory + 'db_init_log.txt'
    );
    Alert.alert('DB Log', log);
  }}
/>
```

### Вариант 3: Через ADB (Android)

```bash
adb exec-out run-as com.yourapp cat files/db_init_log.txt
```

## Что Должно Быть в Логе

```
[timestamp] 🔧 initDatabase started
[timestamp] 📂 DB path: /path/to/dikoros_v12.db
[timestamp] 🗑️ Deleting old database to update...
[timestamp] 📥 Copying fresh database from assets...
[timestamp] 📦 Asset localUri: /path/to/asset
[timestamp] ✅ Asset downloaded
[timestamp] ✅ Database copied to: /path
[timestamp] 📊 Total products in DB: 354  ← ВАЖНО!
[timestamp] 🆕 New variants (349-354): 6  ← ВАЖНО!
[timestamp] 📋 New variants details: [{"id":349,"price":500},...] ← ВАЖНО!
```

**Если Total products = 348 (не 354), значит старая БД не обновилась!**
