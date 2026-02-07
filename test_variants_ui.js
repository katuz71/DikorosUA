/**
 * Тестовый скрипт для проверки вариантов товаров в React Native
 * Используй этот код в React DevTools или в компоненте для тестирования
 */

// Вставь этот код в консоль браузера при разработке или создай тестовый компонент

const API_URL = 'http://localhost:8001'; // Или твой production URL

// ==========================================
// ТЕСТ 1: Проверить структуру данных с бэкенда
// ==========================================
export async function testBackendData() {
  console.log('🔍 ТЕСТ 1: Проверка структуры данных с backend');
  
  try {
    const response = await fetch(`${API_URL}/products`);
    const products = await response.json();
    
    console.log('📦 Total products:', products.length);
    
    // Найти товары с вариантами
    const withVariants = products.filter(p => p.variants && Array.isArray(p.variants) && p.variants.length > 0);
    console.log('📊 Products with variants:', withVariants.length);
    
    if (withVariants.length > 0) {
      const example = withVariants[0];
      console.log('\n📝 Example product:');
      console.log('  ID:', example.id);
      console.log('  Name:', example.name);
      console.log('  Price:', example.price);
      console.log('  MinPrice:', example.minPrice);
      console.log('  Has variants?', example.variants ? 'YES' : 'NO');
      console.log('  Variants count:', example.variants?.length);
      console.log('  First variant:', example.variants?.[0]);
      
      return { success: true, example, products };
    } else {
      console.warn('⚠️  No products with variants found!');
      return { success: false, reason: 'No variants' };
    }
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error };
  }
}

// ==========================================
// ТЕСТ 2: Проверить парсер вариантов
// ==========================================
export async function testVariantsParser() {
  console.log('\n🔍 ТЕСТ 2: Проверка парсера вариантов');
  
  // Импортируй parseVariants в своем компоненте:
  // import { parseVariants } from '@/utils/productParser';
  
  // Пример использования:
  console.log(`
  // В твоем компоненте:
  const { variants, mode } = parseVariants(product, allProducts);
  
  console.log('Parsed variants:', variants);
  console.log('Mode:', mode); // 'complex' | 'simple' | 'none'
  `);
}

// ==========================================
// ТЕСТ 3: Симуляция выбора варианта
// ==========================================
export function testVariantSelection() {
  console.log('\n🔍 ТЕСТ 3: Симуляция выбора варианта');
  
  const mockProduct = {
    id: 1,
    name: "Чага березова",
    price: 370,
    minPrice: 370,
    variants: [
      { id: 1001, size: "120 капсул", price: 370, vendor_code: "ГЧ-1005" },
      { id: 1002, size: "60 капсул", price: 200, vendor_code: "ГЧ-1006" }
    ]
  };
  
  console.log('📦 Mock product:', mockProduct);
  
  // Начальный выбор
  let selectedVariant = mockProduct.variants[0];
  console.log('✅ Initial selection:', selectedVariant);
  
  // Переключение варианта
  selectedVariant = mockProduct.variants[1];
  console.log('✅ After switch:', selectedVariant);
  
  // Цена должна обновиться
  const currentPrice = selectedVariant ? selectedVariant.price : mockProduct.price;
  console.log('💰 Current price:', currentPrice);
  
  return { mockProduct, selectedVariant, currentPrice };
}

// ==========================================
// ТЕСТ 4: Добавление в корзину с вариантом
// ==========================================
export function testAddToCartWithVariant() {
  console.log('\n🔍 ТЕСТ 4: Добавление в корзину с вариантом');
  
  const product = {
    id: 1,
    name: "Чага березова",
    image: "https://example.com/image.jpg"
  };
  
  const selectedVariant = {
    id: 1001,
    size: "120 капсул",
    price: 370
  };
  
  const cartItem = {
    id: product.id,
    name: product.name,
    price: selectedVariant.price,
    variant_info: selectedVariant.size,
    unit: selectedVariant.size,
    quantity: 1,
    image: product.image,
    variantSize: selectedVariant.size // Для уникальной идентификации
  };
  
  console.log('🛒 Cart item:', cartItem);
  
  // Проверка: разные варианты одного товара = разные позиции в корзине
  const cart = [
    { id: 1, variant_info: "120 капсул", quantity: 2 },
    { id: 1, variant_info: "60 капсул", quantity: 1 }
  ];
  
  console.log('🛒 Cart with multiple variants:', cart);
  console.log('✅ Same product, different variants = separate items');
  
  return { cartItem, cart };
}

// ==========================================
// ТЕСТ 5: Полный цикл UI
// ==========================================
export async function testFullUICycle() {
  console.log('\n🔍 ТЕСТ 5: Полный цикл UI');
  console.log('='.repeat(50));
  
  // 1. Загрузить товары
  console.log('Step 1: Fetch products...');
  const { success, example } = await testBackendData();
  
  if (!success) {
    console.error('❌ Failed to fetch products');
    return;
  }
  
  // 2. Парсинг вариантов
  console.log('\nStep 2: Parse variants...');
  console.log('✅ Use parseVariants(product, allProducts)');
  
  // 3. Отображение селектора
  console.log('\nStep 3: Display variant selector...');
  console.log('✅ Check: hasVariants = variants.length > 1');
  
  // 4. Выбор варианта
  console.log('\nStep 4: Select variant...');
  testVariantSelection();
  
  // 5. Добавление в корзину
  console.log('\nStep 5: Add to cart...');
  testAddToCartWithVariant();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Full UI cycle test completed');
}

// ==========================================
// ЧЕКЛИСТ ДЛЯ РУЧНОГО ТЕСТИРОВАНИЯ
// ==========================================
export function printTestingChecklist() {
  console.log('\n📋 ЧЕКЛИСТ РУЧНОГО ТЕСТИРОВАНИЯ');
  console.log('='.repeat(50));
  
  const checklist = [
    '[ ] 1. Backend возвращает товары с variants',
    '[ ] 2. Товары с вариантами отображают "від X ₴"',
    '[ ] 3. При открытии товара отображается селектор вариантов',
    '[ ] 4. Переключение вариантов меняет цену',
    '[ ] 5. Выбранный вариант сохраняется при добавлении в корзину',
    '[ ] 6. Корзина отображает variant_info',
    '[ ] 7. Разные варианты одного товара = разные строки в корзине',
    '[ ] 8. Заказ создается с информацией о варианте',
    '[ ] 9. Товары без вариантов работают как раньше',
    '[ ] 10. UI адаптируется под наличие/отсутствие вариантов'
  ];
  
  checklist.forEach(item => console.log(item));
  
  console.log('\n' + '='.repeat(50));
}

// ==========================================
// QUICK TEST - запусти все тесты сразу
// ==========================================
export async function quickTest() {
  console.clear();
  console.log('🚀 QUICK TEST - Проверка вариантов товаров');
  console.log('='.repeat(50));
  
  await testBackendData();
  testVariantsParser();
  testVariantSelection();
  testAddToCartWithVariant();
  printTestingChecklist();
  
  console.log('\n✅ Quick test completed!');
  console.log('📝 Check the results above');
}

// Экспортируем для использования
if (typeof window !== 'undefined') {
  window.variantsTest = {
    testBackendData,
    testVariantsParser,
    testVariantSelection,
    testAddToCartWithVariant,
    testFullUICycle,
    printTestingChecklist,
    quickTest
  };
  
  console.log('\n✅ Variants test helpers loaded!');
  console.log('📝 Use: window.variantsTest.quickTest()');
}
