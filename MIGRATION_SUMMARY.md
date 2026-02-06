# Migration Summary: Product Variability Logic (BASE → TARGET)

## Цель
Перенести рабочую логику вариативности товаров и описаний из BASE (5e0609d) в TARGET (a6bee42, ветка fix/external-id-endpoint).

## Проблема в TARGET
1. **✖ Неверный эндпоинт**: Попытка загрузки товара через `/products/${productId}`, которого не существует в API
2. **✖ Fallback на локальную БД**: Использование `getProductById()` из локальной SQLite
3. **✖ Сломанная логика вариативности**: Избыточные useEffect, неправильный state (`activeVariant`, `selectedOptions[]`)
4. **✖ Дублирование логики**: Множественные функции для одной задачи

## Решение

### 1. Загрузка товара
**БЫЛО (TARGET - НЕПРАВИЛЬНО):**
```typescript
// Попытка fetch /products/${productId} → 404/405
// Fallback на getProductById() из локальной БД
```

**СТАЛО (правильно):**
```typescript
// Загрузка ТОЛЬКО из контекста OrdersContext
useEffect(() => {
  if (!id || !products || products.length === 0) return;
  const productId = Number(Array.isArray(id) ? id[0] : id);
  const found = products.find((p: any) => p.id === productId);
  if (found) setProduct(found);
}, [products, id]);
```

**Источник данных**: Товары уже загружены OrdersContext через `/products` (возвращает ВСЕ товары со всеми полями)

### 2. State для вариативности
**БЫЛО (TARGET - НЕПРАВИЛЬНО):**
```typescript
const [activeVariant, setActiveVariant] = useState<any>(null);
const [selectedOptions, setSelectedOptions] = useState<string[]>([]); // массив
```

**СТАЛО (из BASE - правильно):**
```typescript
const [selectedVariant, setSelectedVariant] = useState<any>(null);
const [variationGroups, setVariationGroups] = useState<any[]>([]);
const [selectedVariations, setSelectedVariations] = useState<{[key: string]: string}>({}); // словарь
```

### 3. Функция поиска варианта
**ДОБАВЛЕНО из BASE:**
```typescript
const findBestVariant = useCallback((variants: any[], selections: any) => {
  // Поиск варианта по словарю selections: {groupId: value}
  const found = variants.find((v: any) => {
    return Object.keys(selections).every(key => {
      const selectedVal = selections[key];
      const variantVal = v.attrs ? v.attrs[key] : null;
      return String(variantVal || '').toLowerCase().trim() === 
             String(selectedVal || '').toLowerCase().trim();
    });
  });
  return found;
}, []);
```

### 4. Инициализация вариантов
**ДОБАВЛЕНО из BASE:**
```typescript
useEffect(() => {
  if (!product) return;
  loadReviews();

  if (product.variationGroups && product.variationGroups.length > 0) {
    setVariationGroups(product.variationGroups);
    
    // Автоматически выбираем первые опции
    const initialSelections: any = {};
    product.variationGroups.forEach((group: any) => {
      if (group.options?.length > 0) {
        initialSelections[group.id] = group.options[0];
      }
    });
    setSelectedVariations(initialSelections);

    // Находим соответствующий вариант
    const matchingVariant = findBestVariant(variants, initialSelections);
    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
      setCurrentPrice(matchingVariant.price);
    } else {
      setCurrentPrice(product.price);
    }
  } else {
    // Fallback для простых товаров без групп
    setCurrentPrice(product.price);
  }
}, [product, variants, findBestVariant]);
```

### 5. Обработчик выбора атрибута
**ДОБАВЛЕНО из BASE:**
```typescript
const handleVariationSelect = useCallback((groupId: string, value: string) => {
  const newSelections = { ...selectedVariations, [groupId]: value };
  setSelectedVariations(newSelections);

  const matchingVariant = findBestVariant(variants, newSelections);
  if (matchingVariant) {
    setSelectedVariant(matchingVariant);
    setCurrentPrice(matchingVariant.price);
  } else {
    setSelectedVariant(null);
  }
}, [selectedVariations, variants, findBestVariant]);
```

### 6. UI для выбора вариантов
**БЫЛО (TARGET - НЕПРАВИЛЬНО):**
```tsx
{matrixOptions?.titles?.map(...)} // Сложная матрица
```

**СТАЛО (из BASE - правильно):**
```tsx
{variationGroups.map((group: any) => (
  <View key={group.id}>
    <Text>{group.title}</Text>
    {group.options.map((option: string) => {
      const isSelected = selectedVariations[group.id] === option;
      return (
        <TouchableOpacity onPress={() => handleVariationSelect(group.id, option)}>
          <Text>{option}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
))}
```

### 7. Отображение описаний
**НЕ ИЗМЕНЕНО** (уже было правильно):
```tsx
{activeTab === 'description' && <Text>{product.description || ''}</Text>}
{activeTab === 'instruction' && (
  <>
    <Text>{product.usage || ''}</Text>
    <Text>{product.composition || ''}</Text>
  </>
)}
```
Описания загружаются вместе с товаром через `/products` и хранятся в `product`.

## Удаленный код
1. **✓** Импорт `getProductById` из `services/database`
2. **✓** Fetch `/products/${productId}` (несуществующий эндпоинт)
3. **✓** Fallback на локальную БД
4. **✓** Функции: `getVariantByOptions`, `handleMatrixOptionSelect`, `matrixOptions`
5. **✓** State: `activeVariant`, `selectedOptions[]`
6. **✓** Избыточные useEffect для обновления вариантов

## Структура данных

### Product (из API `/products`)
```typescript
{
  id: number,
  name: string,
  price: number,
  old_price?: number,
  description?: string,
  composition?: string,
  usage?: string,
  variants?: Variant[],
  variationGroups?: VariationGroup[],
  ...
}
```

### VariationGroup (из product.variationGroups)
```typescript
{
  id: string,        // 'weight', 'form', 'sort', etc.
  title: string,     // 'Вага', 'Форма випуску', 'Сорт'
  options: string[]  // ['50г', '100г', '250г']
}
```

### Variant (из product.variants)
```typescript
{
  id: number,
  price: number,
  old_price?: number,
  attrs: {
    weight?: string,
    form?: string,
    sort?: string,
    ...
  }
}
```

## Чек-лист ручной проверки

### ✅ Загрузка товара
- [ ] Товар загружается из контекста OrdersContext
- [ ] Не используется локальная БД
- [ ] Не делается fetch на несуществующий `/products/${id}`

### ✅ Вариативность
- [ ] При открытии страницы автоматически выбраны первые опции
- [ ] currentPrice установлен корректно
- [ ] При выборе другой опции обновляется цена
- [ ] Текст "Обрано: [варианты]" отображается правильно
- [ ] Кнопка "В кошик" добавляет товар с правильным вариантом и ценой

### ✅ Описания
- [ ] Вкладка "Опис" показывает product.description
- [ ] Вкладка "Інструкція" показывает product.usage и product.composition
- [ ] Вкладка "Доставка" показывает product.delivery_info
- [ ] Вкладка "Повернення" показывает product.return_info

### ✅ Общее
- [ ] Нет ошибок в консоли
- [ ] Нет дублей запросов
- [ ] Работает только с прод-сервером (API_URL)
- [ ] Нет AbortController и таймаутов в бизнес-логике

## Измененные файлы
- `app/product/[id].tsx` - полностью переписана логика загрузки и вариативности

## Финальное состояние
- **Источник данных**: ТОЛЬКО сервер через OrdersContext
- **Вариативность**: Рабочая логика из BASE (variationGroups + findBestVariant)
- **Описания**: Корректно отображаются из product
- **Код**: Чистый, без дублей, без лишних useEffect
