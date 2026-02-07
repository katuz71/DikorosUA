const API_URL = 'https://app.dikoros.ua';

async function findAll120() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Ищем товары с "120" в названии
  const with120 = products.filter(p => 
    p.name?.includes('120')
  );
  
  console.log(`Found ${with120.length} products with "120" in name:\n`);
  
  with120.forEach(p => {
    console.log(`ID: ${p.id} | ${p.name} | ${p.price} грн`);
  });
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Checking all microdosing with "60 по" or "капсул"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const microdosing = products.filter(p => 
    p.name?.toLowerCase().includes('мікродозінг') &&
    (p.name?.includes('60 по') || p.name?.includes('капсул'))
  );
  
  microdosing.forEach(p => {
    console.log(`ID: ${p.id} | Group: ${p.group_id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Price: ${p.price} грн\n`);
  });
}

findAll120().catch(console.error);
