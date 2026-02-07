// utils/productParser.ts

export interface ParsedVariant {
  id: number;
  price: number;
  old_price?: number;
  title: string;
  grade: string;
  type: string;
  weight: string;
  normGrade: string;
  normType: string;
  normWeight: string;
  isComplex: boolean;
  origVariant: any;
}

const normalize = (str: string | number | undefined) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, '');
};

export const parseVariants = (currentProduct: any, allProducts: any[]): { variants: ParsedVariant[], mode: 'complex' | 'simple' | 'none' } => {
  if (!currentProduct) return { variants: [], mode: 'none' };

  let rawItems: any[] = [];

  // 1. СТРАТЕГИЯ ГРУППИРОВКИ (Как в твоем скрипте)
  // Если есть group_id, ищем всех братьев в общем списке
  if (currentProduct.group_id && allProducts.length > 0) {
    rawItems = allProducts.filter(p => String(p.group_id) === String(currentProduct.group_id));
  }

  // Если братьев нет (или только 1), проверяем variants внутри товара
  if (rawItems.length <= 1 && currentProduct.variants) {
    try {
      const parsed = typeof currentProduct.variants === 'string' 
        ? JSON.parse(currentProduct.variants) 
        : currentProduct.variants;
      if (Array.isArray(parsed) && parsed.length > 0) {
        rawItems = parsed;
      }
    } catch (e) {}
  }

  // HARDCODED VARIANTS: Для товарів без variants в БД, але з вибором на сайті
  if (rawItems.length <= 1 && currentProduct.id === 4157) {
    // Мікродозінг Стандарт - 60 і 120 капсул
    rawItems = [
      { size: '60 капсул|0.5г', price: 332 },
      { size: '120 капсул|0.5г', price: 620 }
    ];
  }

  // Если вообще ничего не нашли, товар - одиночка
  if (rawItems.length === 0) {
    rawItems = [currentProduct];
  }

  // 2. АНАЛИЗ СЛОЖНОСТИ (Мухомор или Капсулы?)
  const hasGrade = rawItems.some((v: any) => {
    const t = (v.name || v.title || v.label || v.size || '').toLowerCase();
    return t.includes('сорт') || t.includes('еліт') || t.includes('elit');
  });
  
  // Проверяем сколько уникальных форм есть
  const uniqueTypes = new Set(
    rawItems.map((v: any) => {
      const t = (v.name || v.title || v.label || v.size || '').toLowerCase();
      const parts = t.split('|').map((p: string) => p.trim());
      
      // Определяем какая часть содержит форму
      let formPart = '';
      
      if (parts.length >= 3) {
        // Формат: "Сорт|Форма|Вага" - форма в средней части
        formPart = parts[1];
      } else if (parts.length === 2) {
        // Формат: "Форма|Вага" или "Сорт|Форма"
        // Если первая часть - сорт, берем вторую
        if (parts[0].includes('сорт') || parts[0].includes('еліт') || parts[0].includes('elit')) {
          formPart = parts[1];
        } else {
          formPart = parts[0];
        }
      } else {
        // Одна часть - ищем по ключевым словам
        formPart = t;
      }
      
      // Нормализуем форму
      if (formPart.includes('порошок') || formPart.includes('мелений')) return 'порошок';
      if (formPart.includes('капсул')) return 'капсули';
      if (formPart.includes('настоянка')) return 'настоянка';
      if (formPart.includes('шляпк')) return 'шляпки';
      if (formPart.includes('ніжк')) return 'ніжки';
      if (formPart.includes('ціл')) return 'цілі';
      if (formPart.includes('міцелій')) return 'міцелій';
      if (formPart.includes('лом')) return 'лом';
      
      // Если не распознали, возвращаем саму часть (очищенную)
      return formPart.replace(/[^\p{L}]/gu, '').toLowerCase() || '';
    })
  );
  uniqueTypes.delete(''); // Удаляем пустые
  
  const hasMultipleTypes = uniqueTypes.size > 1;

  // Режим Complex: Если товаров > 1 И (есть разные сорта ИЛИ есть разные формы)
  // Режим Simple: Если товаров > 1, но форма одна (просто разный вес/кол-во)
  // Режим None: Если товар 1
  let mode: 'complex' | 'simple' | 'none' = 'none';
  if (rawItems.length > 1) {
    mode = (hasGrade || hasMultipleTypes) ? 'complex' : 'simple';
  }

  // 3. ПАРСИНГ КАЖДОГО ВАРИАНТА
  const parsed = rawItems.map((v: any, index: number) => {
    // Поддержка разных форматов: name/title/label (из products) или size (из variants field)
    const title = (v.name || v.title || v.label || v.size || '').toString();
    const titleLower = title.toLowerCase();

    let grade = '2 сорт'; // Дефолт
    let type = 'Цілі';    // Дефолт
    let weight = title;   // Дефолт (если не найдем цифр)

    // Regex парсер
    const weightMatch = titleLower.match(/(\d+(?:[\.,]\d+)?)\s*(?:грам|г|гр|кг|мл|l|л|капсул|шт)/);
    if (weightMatch) {
      weight = weightMatch[0]
        .replace('грам', 'г')
        .replace('гр', 'г')
        .replace(/\s+/g, ''); // Убираем пробелы (50 г)
    }

    if (mode === 'complex') {
      // Парсинг сорту
      if (titleLower.includes('1 сорт') || titleLower.includes('1-й сорт') || titleLower.includes('1сорт')) grade = '1 сорт';
      else if (titleLower.includes('еліт') || titleLower.includes('elit') || titleLower.includes('вищий')) grade = 'Еліт';
      else if (titleLower.includes('2 сорт') || titleLower.includes('2-й сорт') || titleLower.includes('2сорт')) grade = '2 сорт';

      // Парсинг форми
      if (titleLower.includes('порошок') || titleLower.includes('мелений')) type = 'Порошок';
      else if (titleLower.includes('капсул')) type = 'Капсули';
      else if (titleLower.includes('настоянка')) type = 'Настоянка';
      else if (titleLower.includes('екстракт')) type = 'Екстракт';
      else if (titleLower.includes('шляпк')) type = 'Шляпки';
      else if (titleLower.includes('ніжк')) type = 'Ніжки';
      else if (titleLower.includes('ціл')) type = 'Цілі';
    } else {
      // В простом режиме используем весь title как label кнопки
      // Но пытаемся извлечь только вес/размер если он есть отдельно
      if (weightMatch) {
        weight = weightMatch[0].replace('грам', 'г').replace('гр', 'г').replace(/\s+/g, '');
      } else {
        // Если регекс не сработал, используем весь title
        weight = title || `Варіант ${index + 1}`;
      }
    }

    return {
      id: v.id || (index + 999999),
      price: Number(v.price),
      old_price: v.old_price ? Number(v.old_price) : undefined,
      title,
      grade,
      type,
      weight,
      normGrade: normalize(grade),
      normType: normalize(type),
      normWeight: normalize(weight),
      isComplex: mode === 'complex',
      origVariant: v
    };
  });

  return { variants: parsed, mode };
};