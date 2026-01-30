// @ts-nocheck
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

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
    
    if (db) {
        try {
            await db.closeAsync();
        } catch (e) {
            console.log('Error closing DB:', e);
        }
        db = null;
    }

    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    
    if (!fileInfo.exists) {
        console.log('📥 Copying database from assets...');
        const dbAsset = Asset.fromModule(require('./shop.db'));
        await dbAsset.downloadAsync();
        await FileSystem.copyAsync({ from: dbAsset.localUri, to: dbPath });
    } else {
        console.log('✅ Database already exists');
    }
    
    await getDb();
  } catch (error) {
    console.error('🔥 Init Error:', error);
  }
};

export const getCategories = async (callback) => {
  try {
    const database = await getDb();
    const query = 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""';
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

const normalizeProduct = (name: string) => {
  const regexes = {
    year: /\b(202[0-9])\b/,
    sort: /(1\s*сорт|2\s*сорт|3\s*сорт|Вищий\s*сорт|Еліт|Elite|Grade\s*[A-Z])/i,
    form: /(Мелен[ийа]|Ціл[іа]|Капсул[иа]|Порошок|Без\s*обробки|Зерноміцелій)/i,
    weight: /(\d+\s*(?:грам|грамм|г\b|кг|мг|мл|шт|капсул))/i
  };

  let attributes: any = {};
  let baseName = name;

  const yMatch = name.match(regexes.year);
  if (yMatch) {
      attributes.year = yMatch[0];
      baseName = baseName.replace(regexes.year, '');
  }

  const sMatch = name.match(regexes.sort);
  if (sMatch) {
      let sortValue = sMatch[0];
      sortValue = sortValue.replace(/(\d+)сорт/i, '$1 сорт');
      attributes.sort = sortValue;
      baseName = baseName.replace(regexes.sort, '');
  }

  const fMatch = name.match(regexes.form);
  if (fMatch) {
      attributes.form = fMatch[0];
      baseName = baseName.replace(regexes.form, '');
  } else if (name.toLowerCase().includes('сушен')) {
      attributes.form = 'Без обробки';
  }

  const wMatch = name.match(regexes.weight);
  if (wMatch) {
      let weightValue = wMatch[0];
      weightValue = weightValue.replace(/(\d+)\s*(грам|г|кг)/i, '$1 $2');
      attributes.weight = weightValue;
      baseName = baseName.replace(regexes.weight, '');
  }

  baseName = baseName
    .replace(/\s+/g, ' ')
    .replace(/[,.-]\s*$/, '')
    .replace(/^\s*[,.-]/, '')
    .replace(/\(\s*\)/g, '')
    .trim();
  
  const variantLabel = [attributes.year, attributes.form, attributes.sort, attributes.weight]
    .filter(Boolean).join(' ');

  return { baseName, attributes, variantLabel };
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
    if (!category || category === null || category === undefined) {
        category = 'Всі';
    }

    if (category !== 'Всі' && category !== 'Все') {
      query += ' WHERE category = ?';
      params = [String(category)];
    }

    const rows = await database.getAllAsync(query, params);
    const groupedMap = new Map();

    rows.forEach(row => {
        const { baseName, attributes, variantLabel } = normalizeProduct(row.name);
        
        if (!groupedMap.has(baseName)) {
            groupedMap.set(baseName, {
                ...row,
                name: baseName,
                variants: [],
                availableOptions: {
                    year: new Set(),
                    sort: new Set(),
                    form: new Set(),
                    weight: new Set()
                }
            });
        }

        const master = groupedMap.get(baseName);
        
        if (attributes.year) master.availableOptions.year.add(attributes.year);
        if (attributes.sort) master.availableOptions.sort.add(attributes.sort);
        if (attributes.form) master.availableOptions.form.add(attributes.form);
        if (attributes.weight) master.availableOptions.weight.add(attributes.weight);

        master.variants.push({
            id: row.id,
            price: row.price,
            old_price: row.old_price,
            image: row.image || row.picture || row.image_url,
            attrs: attributes,
            label: variantLabel,
            pack_size: attributes.weight || variantLabel 
        });
    });

    let finalProducts = Array.from(groupedMap.values()).map(p => {
        const groupsDef = [];
        
        // ФИКСИРОВАННЫЙ ПОРЯДОК: sort → form → weight → year
        if (p.availableOptions.sort.size > 0) {
            groupsDef.push({
                id: 'sort',
                title: 'Сорт',
                options: Array.from(p.availableOptions.sort).sort()
            });
        }
        
        if (p.availableOptions.form.size > 0) {
            groupsDef.push({
                id: 'form',
                title: 'Форма продукту',
                options: Array.from(p.availableOptions.form).sort()
            });
        }

        if (p.availableOptions.weight.size > 0) {
             const sortedWeights = Array.from(p.availableOptions.weight).sort((a: any, b: any) => {
                 const valA = parseFloat(a) || 0;
                 const valB = parseFloat(b) || 0;
                 return valA - valB;
             });
             
            groupsDef.push({
                id: 'weight',
                title: 'Фасування',
                options: sortedWeights
            });
        }
        
        if (p.availableOptions.year.size > 0) {
            groupsDef.push({
                id: 'year',
                title: 'Врожай',
                options: Array.from(p.availableOptions.year).sort().reverse()
            });
        }

        p.variationGroups = groupsDef;
        p.variants.sort((a: any, b: any) => a.price - b.price);

        const mainVariant = p.variants[0];
        p.id = mainVariant.id;
        p.price = mainVariant.price;
        p.minPrice = mainVariant.price;
        p.old_price = mainVariant.old_price;
        
        delete p.availableOptions; 
        
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
