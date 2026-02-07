const API_URL = 'https://app.dikoros.ua';

async function findMicrodosingSeries() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Ищем все товары мікродозінг
  const microdosing = products.filter(p => 
    p.name?.toLowerCase().includes('мікродозінг')
  );
  
  console.log(`Found ${microdosing.length} microdosing products\n`);
  
  // Группируем по базовому названию (убираем количество)
  const groups = {};
  
  microdosing.forEach(p => {
    // Убираем цифры вроде "60 по 0.5", "150 грам" из названия
    const baseName = p.name
      .replace(/\d+\s*по\s*[\d.,]+\s*грам[аи]?/gi, 'X')
      .replace(/\d+\s*грам[аи]?/gi, 'X')
      .replace(/\d+\s*капсул/gi, 'X')
      .replace(/\s+2025/gi, '')
      .replace(/\s+2024/gi, '')
      .toLowerCase()
      .trim();
    
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push(p);
  });
  
  // Показываем группы где больше 1 товара
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('POTENTIAL GROUPS (multiple products):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  Object.entries(groups)
    .filter(([_, items]) => items.length > 1)
    .forEach(([baseName, items]) => {
      console.log(`\n📦 ${baseName}`);
      console.log(`   Found ${items.length} products:\n`);
      items.forEach(p => {
        console.log(`   - ID ${p.id} | ${p.name}`);
        console.log(`     Price: ${p.price} грн | Group: ${p.group_id}`);
        if (p.variants) {
          try {
            const v = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
            console.log(`     Variants: ${Array.isArray(v) ? v.length : 'not array'}`);
          } catch (e) {}
        }
      });
    });
  
  // Конкретно ищем "Стандарт"
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CHECKING "Стандарт" specifically:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const standart = microdosing.filter(p => 
    p.name.toLowerCase().includes('стандарт')
  );
  
  standart.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Price: ${p.price} грн`);
    console.log(`Group ID: ${p.group_id}`);
    console.log('');
  });
}

findMicrodosingSeries().catch(console.error);
