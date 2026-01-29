// @ts-nocheck
import * as SQLite from 'expo-sqlite';
// Используем legacy для Expo 54+
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const dbName = 'dikoros_v11.db';
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
        if (fileInfo.exists) {
            console.log('🗑️ Deleting old database to force update...');
            await FileSystem.deleteAsync(dbPath);
        }
        
        console.log('📥 Copying fresh database from assets...');
        const dbAsset = Asset.fromModule(require('./dikoros.db'));
        await dbAsset.downloadAsync();
        await FileSystem.copyAsync({ from: dbAsset.localUri, to: dbPath });
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

// Helper to normalize product name and extract variant info
const normalizeProduct = (name: string) => {
  // Regex patterns
  const weightRegex = /(\d+\s*(?:г|кг|мг|мл|шт|капсул[\wа-я]*))/i;
  const typeRegex = /(Цілі|Ламані|Порошок|Капсули)/i;
  const sortRegex = /(Сорт\s+\w+)/i;

  let variantLabel = '';
  let baseName = name;
  let matches = [];

  // Extract features
  const wMatch = name.match(weightRegex);
  if (wMatch) matches.push({ val: wMatch[1] || wMatch[0], index: wMatch.index, type: 'weight' });

  const tMatch = name.match(typeRegex);
  if (tMatch) matches.push({ val: tMatch[1] || tMatch[0], index: tMatch.index, type: 'type' });

  const sMatch = name.match(sortRegex);
  if (sMatch) matches.push({ val: sMatch[1] || sMatch[0], index: sMatch.index, type: 'sort' });
  
  // Clean base name
  baseName = baseName
    .replace(weightRegex, '')
    .replace(typeRegex, '')
    .replace(sortRegex, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove trailing chars
  baseName = baseName.replace(/[,-\s]+$/, '');
  
  // Construct Label
  // Priority: Weight > Type > Sort
  let parts = [];
  if (wMatch) parts.push(wMatch[1]);
  if (tMatch) parts.push(tMatch[1]);
  if (sMatch) parts.push(sMatch[1]);
  
  variantLabel = parts.join(' ') || 'Стандарт';
  
  return { baseName, variantLabel };
};

export const getProducts = async (category = 'Всі', callback) => {
  try {
    const database = await getDb();
    let query = 'SELECT * FROM products';
    let params = [];

    // 1. Argument handling
    if (typeof category === 'function') {
      callback = category;
      category = 'Всі';
    }
    if (!category || category === null || category === undefined) {
        category = 'Всі';
    }

    // 2. Query construction
    if (category !== 'Всі' && category !== 'Все') {
      query += ' WHERE category = ?';
      params = [String(category)];
    }

    console.log(`🛒 SQL Exec Gropped: "${query}" | Params: ${JSON.stringify(params)}`);

    // 3. Fetch
    const rows = await database.getAllAsync(query, params);
    
    // 4. Grouping Logic
    const groupedMap = new Map();

    rows.forEach(row => {
        const { baseName, variantLabel } = normalizeProduct(row.name);
        
        if (!groupedMap.has(baseName)) {
            groupedMap.set(baseName, {
                ...row,
                name: baseName, // Use clean name
                variants: [],
                original_row: row // Keep ref if needed
            });
        }

        const master = groupedMap.get(baseName);
        
        // Add variant
        master.variants.push({
            id: row.id,
            label: variantLabel,
            price: row.price,
            old_price: row.old_price,
            image: row.image || row.picture || row.image_url, // Cache image for variant
            pack_size: variantLabel // Legacy support attempt
        });
    });

    // 5. Finalize
    let finalProducts = Array.from(groupedMap.values()).map(p => {
        // Sort variants: cheap first, or by weight logic if needed
        p.variants.sort((a, b) => a.price - b.price);
        
        // Setup Master props based on the "main" variant (usually cheapest/first)
        const mainVariant = p.variants[0];
        p.id = mainVariant.id; // Master ID = first variant ID
        p.price = mainVariant.price;
        p.minPrice = mainVariant.price;
        p.old_price = mainVariant.old_price;
        // p.pack_sizes = p.variants.map(v => v.label); // Optional: helper for legacy UI
        
        return p;
    });

    if (callback && typeof callback === 'function') {
      callback(finalProducts);
    }
    return finalProducts;
  } catch (e) {
    console.error("❌ getProducts Error:", e);
    if (callback && typeof callback === 'function') callback([]);
    return [];
  }
};