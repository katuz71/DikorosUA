// Тест парсинга изображений из API
console.log('🚀 Скрипт запущен\n');

const testCases = [
  {
    name: "JSON массив в строке",
    input: '["https://example.com/img1.png", "https://example.com/img2.png"]',
    expected: 2
  },
  {
    name: "Строка с запятыми",
    input: "https://example.com/img1.png, https://example.com/img2.png",
    expected: 2
  },
  {
    name: "Один URL",
    input: "https://example.com/img1.png",
    expected: 1
  },
  {
    name: "Пустая строка",
    input: "",
    expected: 0
  }
];

// Копия функции parseImages из utils/image.ts
function parseImages(imagesData) {
  if (!imagesData) return [];
  
  if (Array.isArray(imagesData)) {
    return imagesData.map(url => String(url).trim()).filter(url => url);
  }
  
  const str = String(imagesData).trim();
  if (!str) return [];
  
  // Если это JSON массив в виде строки
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(url => String(url).trim()).filter(url => url);
      }
    } catch (e) {
      console.error('Failed to parse images JSON:', str, e);
    }
  }
  
  // Если обычная строка с запятыми
  if (str.includes(',')) {
    return str.split(',').map(url => url.trim()).filter(url => url);
  }
  
  // Один URL
  return [str];
}

console.log('🧪 Тестирование parseImages:\n');

testCases.forEach(test => {
  const result = parseImages(test.input);
  const passed = result.length === test.expected;
  console.log(`${passed ? '✅' : '❌'} ${test.name}`);
  console.log(`   Вход: ${test.input.substring(0, 50)}${test.input.length > 50 ? '...' : ''}`);
  console.log(`   Результат: ${result.length} изображений`);
  if (result.length > 0) {
    console.log(`   Первое: ${result[0]}`);
  }
  console.log('');
});

// Реальный тест с API
console.log('🌐 Тест с реальными данными из API:\n');

if (typeof fetch === 'undefined') {
  console.log('⚠️ fetch не доступен в этой версии Node.js');
  console.log('Используйте Node.js 18+ или установите node-fetch');
  process.exit(0);
}

fetch('https://app.dikoros.ua/products')
  .then(r => r.json())
  .then(products => {
    const sampleProducts = products.slice(0, 5);
    
    sampleProducts.forEach(p => {
      const images = parseImages(p.images);
      console.log(`📦 ${p.name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   images (raw): ${typeof p.images} - ${String(p.images).substring(0, 50)}...`);
      console.log(`   Распарсено: ${images.length} изображений`);
      if (images.length > 0) {
        console.log(`   Первое: ${images[0].substring(0, 60)}...`);
      } else {
        console.log(`   ⚠️ Нет изображений! Fallback: ${p.image}`);
      }
      console.log('');
    });
  })
  .catch(err => {
    console.error('❌ Ошибка при получении данных:', err.message);
  });
