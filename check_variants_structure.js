const API_URL = 'https://app.dikoros.ua';

async function checkVariants() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Находим мухомор ID 4167
  const mushroom = products.find(p => p.id === 4167);
  
  if (!mushroom) {
    console.log('❌ Product 4167 not found');
    return;
  }
  
  console.log('📦 Product:', mushroom.name);
  console.log('Group ID:', mushroom.group_id);
  console.log('\n');
  
  let variants = [];
  try {
    variants = typeof mushroom.variants === 'string' 
      ? JSON.parse(mushroom.variants) 
      : mushroom.variants;
  } catch (e) {
    console.log('❌ Failed to parse variants');
    return;
  }
  
  console.log(`Found ${variants.length} variants:\n`);
  
  // Группируем по сорту и весу
  const matrix = {};
  
  variants.forEach((v, i) => {
    const size = v.size || '';
    const parts = size.split('|');
    const grade = parts[0] || '?';
    const form = parts[1] || '?';
    const weight = parts[2] || '?';
    
    console.log(`${i + 1}. "${size}" → Сорт: "${grade}", Форма: "${form}", Вага: "${weight}", Ціна: ${v.price} грн`);
    
    if (!matrix[grade]) matrix[grade] = {};
    if (!matrix[grade][weight]) matrix[grade][weight] = [];
    matrix[grade][weight].push({ form, price: v.price });
  });
  
  console.log('\n\n📊 MATRIX (Сорт × Вага):\n');
  Object.keys(matrix).sort().forEach(grade => {
    console.log(`\n${grade}:`);
    Object.keys(matrix[grade]).sort().forEach(weight => {
      const items = matrix[grade][weight];
      const prices = [...new Set(items.map(i => i.price))];
      const forms = items.map(i => i.form).join(', ');
      console.log(`  ${weight}: ${prices.join('/')} грн [${forms}]`);
    });
  });
}

checkVariants().catch(console.error);
