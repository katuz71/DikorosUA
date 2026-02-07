const API_URL = 'https://app.dikoros.ua';

async function checkSpecific() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Проверяем товар ID 4218 (XL с 2 вариантами)
  const product = products.find(p => p.id === 4218);
  
  if (!product) {
    console.log('Product not found');
    return;
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PRODUCT:', product.name);
  console.log('ID:', product.id);
  console.log('Price:', product.price);
  console.log('Group ID:', product.group_id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const variants = typeof product.variants === 'string' 
    ? JSON.parse(product.variants) 
    : product.variants;
  
  console.log('Variants:');
  variants.forEach((v, i) => {
    console.log(`\n${i + 1}.`, JSON.stringify(v, null, 2));
  });
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CHECKING ID 4219 (MIX XL with 2 variants)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const product2 = products.find(p => p.id === 4219);
  if (product2) {
    console.log('Name:', product2.name);
    console.log('Price:', product2.price);
    const v2 = typeof product2.variants === 'string' ? JSON.parse(product2.variants) : product2.variants;
    console.log('\nVariants:');
    v2.forEach((v, i) => {
      console.log(`${i + 1}.`, JSON.stringify(v, null, 2));
    });
  }
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CHECKING ID 4189 (XXL Траметес with 2 variants)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const product3 = products.find(p => p.id === 4189);
  if (product3) {
    console.log('Name:', product3.name);
    console.log('Price:', product3.price);
    const v3 = typeof product3.variants === 'string' ? JSON.parse(product3.variants) : product3.variants;
    console.log('\nVariants:');
    v3.forEach((v, i) => {
      console.log(`${i + 1}.`, JSON.stringify(v, null, 2));
    });
  }
}

checkSpecific().catch(console.error);
