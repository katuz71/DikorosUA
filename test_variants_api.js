// Тестовый скрипт для проверки API и структуры данных с вариантами
// Запуск: node test_variants_api.js

const API_URL = 'http://localhost:8001';

// 1. Тест GET /products
async function testProductsList() {
  console.log('\n📦 ТЕСТ 1: GET /products');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/products`);
    const products = await response.json();
    
    console.log(`✅ Всего товаров: ${products.length}`);
    
    // Находим товары с вариантами
    const withVariants = products.filter(p => p.variants && p.variants.length > 0);
    console.log(`📊 Товаров с вариантами: ${withVariants.length}`);
    
    if (withVariants.length > 0) {
      const example = withVariants[0];
      console.log('\n📝 Пример товара с вариантами:');
      console.log(JSON.stringify({
        id: example.id,
        name: example.name,
        price: example.price,
        minPrice: example.minPrice,
        category: example.category,
        variants: example.variants,
        option_names: example.option_names
      }, null, 2));
    }
    
    return { success: true, products };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}

// 2. Тест GET /products/{id} для товара с вариантами
async function testProductDetail(productId) {
  console.log(`\n📦 ТЕСТ 2: GET /products/${productId}`);
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/products/${productId}`);
    const product = await response.json();
    
    console.log(`✅ Товар: ${product.name}`);
    console.log(`💰 Цена: ${product.price} ₴`);
    console.log(`🔢 Вариантов: ${product.variants?.length || 0}`);
    
    if (product.variants && product.variants.length > 0) {
      console.log('\n📋 Варианты:');
      product.variants.forEach((v, idx) => {
        console.log(`  ${idx + 1}. ${v.size || v.title || 'N/A'} - ${v.price} ₴ (ID: ${v.id})`);
      });
    }
    
    return { success: true, product };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}

// 3. Тест создания заказа с вариантами
async function testCreateOrder() {
  console.log('\n📦 ТЕСТ 3: POST /create_order');
  console.log('='.repeat(50));
  
  const orderData = {
    name: 'Тестовый Покупатель',
    user_phone: '380501234567',
    phone: '380501234567',
    email: 'test@example.com',
    contact_preference: 'telegram',
    city: 'Київ',
    cityRef: 'test-ref',
    warehouse: 'Відділення №1',
    warehouseRef: 'warehouse-ref',
    items: [
      {
        id: 1,
        name: 'Чага березова (Inonotus obliquus) Імунітет+ (120 капсул)',
        price: 370,
        quantity: 1,
        packSize: '120 капсул',
        unit: 'шт',
        variant_info: '120 капсул'
      }
    ],
    totalPrice: 370,
    payment_method: 'card',
    bonus_used: 0,
    use_bonuses: false
  };
  
  try {
    const response = await fetch(`${API_URL}/create_order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Заказ создан успешно');
      console.log(`📝 ID заказа: ${result.order_id || 'N/A'}`);
      console.log(`💰 Сумма: ${result.totalPrice || orderData.totalPrice} ₴`);
    } else {
      console.log('❌ Ошибка создания заказа:', result.detail || result.error);
    }
    
    return { success: response.ok, result };
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return { success: false, error: error.message };
  }
}

// 4. Проверка структуры данных
async function checkDataStructure() {
  console.log('\n📊 ТЕСТ 4: Проверка структуры данных');
  console.log('='.repeat(50));
  
  const { success, products } = await testProductsList();
  
  if (!success) {
    console.log('❌ Не удалось получить список товаров');
    return;
  }
  
  const checks = {
    hasId: 0,
    hasName: 0,
    hasPrice: 0,
    hasVariants: 0,
    hasMinPrice: 0,
    hasImages: 0,
    hasCategory: 0
  };
  
  products.forEach(p => {
    if (p.id) checks.hasId++;
    if (p.name) checks.hasName++;
    if (p.price !== undefined) checks.hasPrice++;
    if (p.variants && p.variants.length > 0) checks.hasVariants++;
    if (p.minPrice !== undefined) checks.hasMinPrice++;
    if (p.image || p.images) checks.hasImages++;
    if (p.category) checks.hasCategory++;
  });
  
  console.log('\n✅ Результаты проверки:');
  console.log(`  ID: ${checks.hasId}/${products.length}`);
  console.log(`  Name: ${checks.hasName}/${products.length}`);
  console.log(`  Price: ${checks.hasPrice}/${products.length}`);
  console.log(`  Variants: ${checks.hasVariants}/${products.length}`);
  console.log(`  MinPrice: ${checks.hasMinPrice}/${products.length}`);
  console.log(`  Images: ${checks.hasImages}/${products.length}`);
  console.log(`  Category: ${checks.hasCategory}/${products.length}`);
  
  return checks;
}

// Основная функция запуска всех тестов
async function runAllTests() {
  console.log('\n🚀 НАЧАЛО ТЕСТИРОВАНИЯ API');
  console.log('='.repeat(50));
  console.log(`API URL: ${API_URL}`);
  console.log(`Время: ${new Date().toLocaleString('uk-UA')}`);
  
  const results = {
    productsList: false,
    productDetail: false,
    createOrder: false,
    dataStructure: false
  };
  
  // Тест 1: Список товаров
  const test1 = await testProductsList();
  results.productsList = test1.success;
  
  // Тест 2: Детальная информация о товаре (если есть товары)
  if (test1.success && test1.products.length > 0) {
    const productWithVariants = test1.products.find(p => p.variants && p.variants.length > 0);
    const testProductId = productWithVariants?.id || test1.products[0].id;
    const test2 = await testProductDetail(testProductId);
    results.productDetail = test2.success;
  }
  
  // Тест 3: Создание заказа (закомментирован чтобы не создавать тестовые заказы)
  // const test3 = await testCreateOrder();
  // results.createOrder = test3.success;
  
  // Тест 4: Проверка структуры
  const test4 = await checkDataStructure();
  results.dataStructure = test4 !== null;
  
  // Итоговый отчет
  console.log('\n' + '='.repeat(50));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ:');
  console.log('='.repeat(50));
  console.log(`✅ Список товаров: ${results.productsList ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✅ Детальная информация: ${results.productDetail ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✅ Создание заказа: ${results.createOrder ? '✅ PASS' : '⏭️  SKIP'}`);
  console.log(`✅ Структура данных: ${results.dataStructure ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = results.productsList && results.productDetail && results.dataStructure;
  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '⚠️  ЕСТЬ ПРОБЛЕМЫ');
  console.log('='.repeat(50));
}

// Запуск
runAllTests().catch(error => {
  console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
  process.exit(1);
});
