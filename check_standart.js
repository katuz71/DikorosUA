const API_URL = 'https://app.dikoros.ua';

async function checkStandart() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  const standart = products.find(p => p.id === 4157);
  
  if (!standart) {
    console.log('❌ Product 4157 not found');
    return;
  }
  
  console.log('📦 Product 4157 (Стандарт):');
  console.log(`Name: ${standart.name}`);
  console.log(`Price: ${standart.price} грн`);
  console.log(`Group ID: ${standart.group_id}`);
  console.log(`Has variants field: ${!!standart.variants}`);
  
  if (standart.variants) {
    try {
      const v = typeof standart.variants === 'string' 
        ? JSON.parse(standart.variants) 
        : standart.variants;
      
      console.log(`\n✅ Variants: ${Array.isArray(v) ? v.length : 'not array'}`);
      
      if (Array.isArray(v)) {
        v.forEach((variant, i) => {
          console.log(`\n  ${i + 1}. ${JSON.stringify(variant, null, 2)}`);
        });
      }
    } catch (e) {
      console.log('❌ Failed to parse variants:', e.message);
    }
  } else {
    console.log('\n❌ No variants field');
  }
}

checkStandart().catch(console.error);
