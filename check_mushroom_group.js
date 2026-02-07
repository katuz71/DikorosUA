const API_URL = 'https://app.dikoros.ua';

async function checkMushroomGroup() {
  console.log('📡 Fetching all products...');
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  console.log(`\n📊 Total products: ${products.length}\n`);
  
  // Ищем все товары мухомора
  const mushrooms = products.filter(p => 
    p.name?.toLowerCase().includes('мухомор') || 
    p.name?.toLowerCase().includes('amanita')
  );
  
  console.log(`🍄 Mushroom products found: ${mushrooms.length}\n`);
  
  // Группируем по group_id
  const byGroup = {};
  mushrooms.forEach(m => {
    const gid = m.group_id || 'NO_GROUP';
    if (!byGroup[gid]) byGroup[gid] = [];
    byGroup[gid].push(m);
  });
  
  console.log('📦 Groups:\n');
  Object.entries(byGroup).forEach(([gid, items]) => {
    console.log(`Group ${gid}: ${items.length} items`);
    items.forEach(item => {
      console.log(`  - ID ${item.id}: ${item.name} (${item.price} грн)`);
    });
    console.log('');
  });
  
  // Проверяем конкретно group_id = 25459
  console.log('\n🔍 Checking group_id = 25459 specifically:');
  const group25459 = products.filter(p => String(p.group_id) === '25459');
  console.log(`Found ${group25459.length} products with group_id = 25459`);
  group25459.forEach(p => {
    console.log(`  - ID ${p.id}: ${p.name}`);
    console.log(`    Price: ${p.price}`);
    console.log(`    Has variants field: ${!!p.variants}`);
    if (p.variants) {
      try {
        const v = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
        console.log(`    Variants count: ${Array.isArray(v) ? v.length : 'not array'}`);
      } catch (e) {
        console.log(`    Variants parse error`);
      }
    }
  });
}

checkMushroomGroup().catch(console.error);
