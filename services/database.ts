// @ts-nocheck
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

// 🔥 ВЕРСИЯ v10 (Финишная прямая)
const dbName = 'dikoros_v10.db';

// ВАЖНО: SQLite ищет базы строго в папке "SQLite"
// Нам нужно создать этот путь вручную
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
    console.log('🚀 Старт v10...');

    // 1. Проверяем и создаем папку SQLite, если её нет
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (!dirInfo.exists) {
        console.log('📂 Создаю системную папку SQLite...');
        await FileSystem.makeDirectoryAsync(sqliteDir);
    }

    // 2. Удаляем старую версию (для чистоты)
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (fileInfo.exists) {
        console.log('♻️ Удаляю старый файл...');
        await FileSystem.deleteAsync(dbPath);
    }

    // 3. Копируем правильный файл в правильную папку
    console.log('📦 Копирую базу в папку SQLite...');
    const dbAsset = Asset.fromModule(require('./dikoros.db')); // Имя файла у тебя dikoros.db
    await dbAsset.downloadAsync();
    
    await FileSystem.copyAsync({ 
        from: dbAsset.localUri, 
        to: dbPath  // Теперь это путь .../SQLite/dikoros_v10.db
    });

    console.log('✅ База на месте.');

    // 4. Проверяем таблицы (Момент истины)
    const database = await getDb();
    const tables = await database.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📊 ТАБЛИЦЫ:', JSON.stringify(tables));
    
    const count = await database.getAllAsync("SELECT count(*) as count FROM products");
    console.log('🍄 ТОВАРОВ:', count[0].count);

  } catch (error) {
    console.error('🔥 Init Error:', error);
  }
};

export const getCategories = async (callback) => {
  try {
    const database = await getDb();
    const result = await database.getAllAsync(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""'
    );
    const cats = result.map(item => item.category);
    const finalData = ['Всі', ...cats];
    if (callback) callback(finalData);
    return finalData;
  } catch (e) {
    console.error("❌ getCategories:", e);
    if (callback) callback(['Всі']);
    return ['Всі'];
  }
};

export const getProducts = async (category = 'Всі', callback) => {
  try {
    const database = await getDb();
    let query = 'SELECT * FROM products';
    let params = [];

    if (typeof category === 'function') {
      callback = category;
      category = 'Всі';
    }

    if (category && category !== 'Всі' && category !== 'Все') {
      query += ' WHERE category = ?';
      params = [category];
    }

    const result = await database.getAllAsync(query, params);
    if (callback) callback(result);
    return result;
  } catch (e) {
    console.error("❌ getProducts:", e);
    if (callback) callback([]);
    return [];
  }
};