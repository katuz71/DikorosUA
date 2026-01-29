// @ts-nocheck
import * as SQLite from 'expo-sqlite';
// Используем legacy для Expo 54+
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const dbName = 'dikoros_v10.db';
const sqliteDir = FileSystem.documentDirectory + 'SQLite';
const dbPath = sqliteDir + '/' + dbName;

let db;

const getDb = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(dbName);
  return db;
};

export const initDatabase = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir);
    }
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (!fileInfo.exists) {
        const dbAsset = Asset.fromModule(require('./dikoros.db'));
        await dbAsset.downloadAsync();
        await FileSystem.copyAsync({ from: dbAsset.localUri, to: dbPath });
    }
    await getDb();
  } catch (error) {
    console.error('🔥 Init Error:', error);
  }
};

export const getCategories = async (callback) => {
  try {
    const database = await getDb();
    // Хардкодим запрос, чтобы он точно не был null
    const query = 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""';
    
    console.log(`🔍 SQL Exec: ${query}`); // ЛОГ
    
    const result = await database.getAllAsync(query);
    const cats = result.map(item => item.category);
    const finalData = ['Всі', ...cats];
    
    if (callback && typeof callback === 'function') {
      callback(finalData);
    }
    return finalData;
  } catch (e) {
    console.error("❌ getCategories Error:", e);
    if (callback && typeof callback === 'function') callback(['Всі']);
    return ['Всі'];
  }
};

// САМОЕ ВАЖНОЕ: Защита в getProducts
export const getProducts = async (category = 'Всі', callback) => {
  try {
    const database = await getDb();
    let query = 'SELECT * FROM products';
    let params = [];

    // 1. Магия аргументов: если первый аргумент - функция, значит категорию не передали
    if (typeof category === 'function') {
      callback = category;
      category = 'Всі';
    }

    // 2. Защита от null/undefined (Причина ошибки Java NullPointerException)
    if (!category || category === null || category === undefined) {
        category = 'Всі';
    }

    // 3. Формируем запрос
    if (category !== 'Всі' && category !== 'Все') {
      query += ' WHERE category = ?';
      // Принудительно превращаем в строку, чтобы избежать ошибок типов
      params = [String(category)];
    }

    // 4. ЛОГИРУЕМ ПЕРЕД ЗАПУСКОМ (Чтобы видеть в терминале)
    console.log(`🛒 SQL Exec: "${query}" | Params: ${JSON.stringify(params)}`);

    // 5. Выполняем
    const result = await database.getAllAsync(query, params);
    
    if (callback && typeof callback === 'function') {
      callback(result);
    }
    return result;
  } catch (e) {
    console.error("❌ getProducts Error:", e);
    if (callback && typeof callback === 'function') callback([]);
    return [];
  }
};