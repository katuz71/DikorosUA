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
    console.log('🚀 initDatabase started');
    const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
    if (!dirInfo.exists) {
        console.log('📁 Creating SQLite directory...');
        await FileSystem.makeDirectoryAsync(sqliteDir);
    }
    
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    console.log(`📊 DB exists: ${fileInfo.exists}, path: ${dbPath}`);
    
    if (fileInfo.exists) {
        console.log('🗑️ Deleting old database to force update...');
        await FileSystem.deleteAsync(dbPath);
        console.log('✅ Old database deleted');
    }
    
    console.log('📥 Copying fresh database from assets...');
    const dbAsset = Asset.fromModule(require('./dikoros.db'));
    console.log(`📦 Asset URI: ${dbAsset.uri}`);
    await dbAsset.downloadAsync();
    console.log(`📦 Local URI: ${dbAsset.localUri}`);
    await FileSystem.copyAsync({ from: dbAsset.localUri, to: dbPath });
    console.log('✅ Database copied successfully');
    
    await getDb();
    console.log('✅ initDatabase completed');
  } catch (error) {
    console.error('🔥 Init Error:', error);
  }
};

export const getCategories = async (callback) => {
  try {
    const database = await getDb();
    const query = 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""';
    
    console.log(`🔍 SQL Exec: ${query}`);
    
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
  const regexes = {
    year: /\b(202[0-9])\b/,
    sort: /(\d\s*сорт|сорт\s*еліт|еліт|вищий\s*сорт|вищий\s*гатунок|преміум)/i,
    form: /(порошок|мелен[іийа]|ціл[іа]|капсул[иа]?|зерноміцелій|ламан[іий]|шматочки)/i,
    weight: /[-–]?\s*(\d+)\s*г+\s*р?\s*а?\s*м+/i,
    volume: /[-–]?\s*(\d+(?:[.,]\d+)?)\s*(мл|літр[аи]?)/i,
    // Капсулы с дозировкой: "60 капсул по 0,5 грама" или "60 капсул по 0,5гр"
    capsulesWithDose: /(\d+)\s*капсул\s+по\s+([\d,]+)\s*г(?:рам[аи]?|р)?/i,
    // Капсулы без дозировки: "60 капсул"
    capsules: /(\d+)\s*капсул/i,
    percentage: /(\d+(?:[.,]\d+)?)%/
  };

  let attributes: any = {};
  let baseName = name;

  // 1. Год
  const yMatch = name.match(regexes.year);
  if (yMatch) {
      attributes.year = yMatch[1];
      baseName = baseName.replace(regexes.year, '');
  }

  // 2. Сорт
  const sMatch = name.match(regexes.sort);
  if (sMatch) {
      let sortValue = sMatch[0].trim();
      // Нормалізуємо "1сорт" -> "1 сорт"
      sortValue = sortValue.replace(/(\d)\s*сорт/i, '$1 сорт');
      // Видаляємо слово "сорт"
      sortValue = sortValue.replace(/сорт\s*/i, '');
      // Capitalize
      sortValue = sortValue.charAt(0).toUpperCase() + sortValue.slice(1).toLowerCase();
      // Спеціальний випадок для "Еліт"
      if (sortValue.toLowerCase().includes('еліт')) sortValue = 'Еліт';
      // Додаємо "сорт" назад для цифрових сортів
      if (sortValue.match(/^\d/)) {
          sortValue = sortValue.trim() + ' сорт';
      }
      attributes.sort = sortValue.trim();
      baseName = baseName.replace(regexes.sort, '');
  }

  // 3. Форма
  const fMatch = name.match(regexes.form);
  if (fMatch) {
      let formValue = fMatch[0].toLowerCase();
      if (formValue.includes('порошок') || formValue.includes('мелен')) {
          attributes.form = 'Порошок';
      } else if (formValue.includes('капсул')) {
          attributes.form = 'Капсули';
      } else if (formValue.includes('ціл')) {
          attributes.form = 'Цілі';
      } else if (formValue.includes('ламан')) {
          attributes.form = 'Ламані';
      } else {
          attributes.form = fMatch[0];
      }
      baseName = baseName.replace(regexes.form, '');
  } else if (name.toLowerCase().includes('сушен') && !name.toLowerCase().includes('порошок')) {
      attributes.form = 'Цілі';
  }

  // 4. Размер (вес/объем/капсулы) - ВАЖНО: сначала проверяем капсулы!
  const cWithDoseMatch = name.match(regexes.capsulesWithDose);
  const cMatch = name.match(regexes.capsules);
  const vMatch = name.match(regexes.volume);
  const wMatch = name.match(regexes.weight);
  const pMatch = name.match(regexes.percentage);
  
  if (cWithDoseMatch) {
      // Капсулы с дозировкой: "60 капсул по 0,5гр"
      attributes.size = `${cWithDoseMatch[1]} капсул`;
      attributes.dose = `по ${cWithDoseMatch[2]}гр`;
      baseName = baseName.replace(regexes.capsulesWithDose, '');
  } else if (cMatch) {
      // Капсулы без дозировки
      attributes.size = `${cMatch[1]} капсул`;
      baseName = baseName.replace(regexes.capsules, '');
  } else if (vMatch) {
      attributes.size = `${vMatch[1]} ${vMatch[2]}`;
      baseName = baseName.replace(regexes.volume, '');
  } else if (wMatch) {
      // Проверяем что это НЕ часть "по X грама" (для капсул)
      const beforeWeight = name.substring(0, wMatch.index || 0);
      const isAfterPo = beforeWeight.match(/по\s+[\d,]*$/i);
      if (!isAfterPo) {
        attributes.size = `${wMatch[1]} грам`;
        baseName = baseName.replace(regexes.weight, '');
      }
  }
  
  // 5. Концентрация
  if (pMatch) {
      attributes.concentration = `${pMatch[1]}%`;
      baseName = baseName.replace(regexes.percentage, '');
  }

  // 6. Очистка baseName
  baseName = baseName
    .replace(/сорт\s*/gi, '')
    .replace(/по\s+[\d,]+\s*грам[аи]?/gi, '')
    .replace(/[-–]\s*$/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s*,\s*$/g, '')
    .replace(/^\s*,\s*/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Формируем label с дозировкой если есть
  let sizeLabel = attributes.size;
  if (attributes.dose) {
    sizeLabel = `${attributes.size} ${attributes.dose}`;
  }
  
  const variantLabel = [attributes.sort, attributes.form, sizeLabel, attributes.concentration]
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

    console.log(`🛒 SQL Exec: "${query}" | Params: ${JSON.stringify(params)}`);

    const rows = await database.getAllAsync(query, params);
    
    // Групуємо за group_id з БД (якщо є) або за baseName
    const groupedMap = new Map();

    rows.forEach(row => {
        const { baseName, attributes, variantLabel } = normalizeProduct(row.name);
        
        // Використовуємо group_id як ключ, якщо він є, інакше baseName
        const groupKey = row.group_id ? `group_${row.group_id}` : `name_${baseName}`;
        
        if (!groupedMap.has(groupKey)) {
            groupedMap.set(groupKey, {
                ...row,
                name: baseName,
                variants: [],
                availableOptions: {
                    year: new Set(),
                    sort: new Set(),
                    form: new Set(),
                    size: new Set(),
                    concentration: new Set()
                }
            });
        }

        const master = groupedMap.get(groupKey);
        
        if (attributes.year) master.availableOptions.year.add(attributes.year);
        if (attributes.sort) master.availableOptions.sort.add(attributes.sort);
        if (attributes.form) master.availableOptions.form.add(attributes.form);
        if (attributes.size) master.availableOptions.size.add(attributes.size);
        if (attributes.concentration) master.availableOptions.concentration.add(attributes.concentration);

        master.variants.push({
            id: row.id,
            price: row.price,
            old_price: row.old_price,
            image: row.image || row.picture || row.image_url,
            attrs: attributes,
            label: variantLabel,
            pack_size: attributes.size || variantLabel 
        });
        
        // Логування для діагностики шляпок мухомора
        if (row.name.includes('Шляпки мухомору червоного') && attributes.sort) {
            console.log(`🍄 [${row.id}] ${row.name.substring(0, 60)}...`);
            console.log(`   Сорт: "${attributes.sort}" | Форма: "${attributes.form}" | Вага: "${attributes.size}" | Ціна: ${row.price} UAH`);
        }
    });

    let finalProducts = Array.from(groupedMap.values()).map(p => {
        // Логування для діагностики
        if (p.variants.length > 1) {
            console.log(`📦 Група: ${p.name} - ${p.variants.length} варіантів`);
        }
        
        const groupsDef = [];
        
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

        if (p.availableOptions.size.size > 0) {
             const sortedSizes = Array.from(p.availableOptions.size).sort((a: any, b: any) => {
                 const valA = parseFloat(a) || 0;
                 const valB = parseFloat(b) || 0;
                 return valA - valB;
             });
             
            groupsDef.push({
                id: 'size',
                title: 'Фасування',
                options: sortedSizes
            });
        }
        
        if (p.availableOptions.concentration.size > 0) {
            const sortedConc = Array.from(p.availableOptions.concentration).sort((a: any, b: any) => {
                const valA = parseFloat(a) || 0;
                const valB = parseFloat(b) || 0;
                return valA - valB;
            });
            
            groupsDef.push({
                id: 'concentration',
                title: 'Концентрація',
                options: sortedConc
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

    const withVariants = finalProducts.filter(p => p.variants.length > 1).length;
    const totalVariants = finalProducts.reduce((sum, p) => sum + p.variants.length, 0);
    
    console.log(`📦 Завантажено товарів: ${finalProducts.length}`);
    console.log(`📦 Груп з варіантами: ${withVariants}`);
    console.log(`📦 Всього варіантів: ${totalVariants}`);

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
