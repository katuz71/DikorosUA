const API_URL = 'https://app.dikoros.ua';

async function checkMicrodosing() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Ищем товары с "Мікродозінг" в названии
  const microdosing = products.filter(p => 
    p.name?.toLowerCase().includes('мікродозінг') ||
    p.name?.toLowerCase().includes('микродозинг')
  );
  
  console.log(`📦 Found ${microdosing.length} microdosing products\n`);
  
  // Группируем по group_id
  const groups = {};
  microdosing.forEach(p => {
    const gid = p.group_id || 'NO_GROUP';
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(p);
  });
  
  console.log(`📊 Groups: ${Object.keys(groups).length}\n`);
  
  // Показываем каждую группу
  Object.entries(groups).forEach(([gid, items]) => {
    console.log(`\n━━━ GROUP ${gid} (${items.length} items) ━━━`);
    items.forEach(p => {
      console.log(`\n  ID: ${p.id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  Price: ${p.price} грн`);
      console.log(`  Has variants field: ${!!p.variants}`);
      
      if (p.variants) {
        try {
          const v = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
          if (Array.isArray(v)) {
            console.log(`  Variants count: ${v.length}`);
            if (v.length > 0) {
              console.log(`  First variant example:`, v[0]);
            }
          }
        } catch (e) {}
      }
    });
  });
  
  // Детально проверяем первый товар с вариантами
  const withVariants = microdosing.find(p => p.variants);
  if (withVariants) {
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 DETAILED CHECK: ${withVariants.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
      const variants = typeof withVariants.variants === 'string' 
        ? JSON.parse(withVariants.variants) 
        : withVariants.variants;
      
      console.log(`Total variants: ${variants.length}\n`);
      variants.forEach((v, i) => {
        console.log(`${i + 1}. ${JSON.stringify(v)}`);
      });
    } catch (e) {
      console.log('Failed to parse variants');
    }
  }
}

checkMicrodosing().catch(console.error);
