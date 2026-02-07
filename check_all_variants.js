const API_URL = 'https://app.dikoros.ua';

async function checkAllVariants() {
  const res = await fetch(`${API_URL}/products`);
  const products = await res.json();
  
  // Ищем все товары с непустыми variants
  const withVariants = products.filter(p => {
    if (!p.variants) return false;
    try {
      const v = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
      return Array.isArray(v) && v.length > 0;
    } catch (e) {
      return false;
    }
  });
  
  console.log(`📦 Found ${withVariants.length} products with variants\n`);
  
  withVariants.forEach(product => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${product.id} | ${product.name}`);
    console.log(`Price: ${product.price} грн | Group: ${product.group_id}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    try {
      const variants = typeof product.variants === 'string' 
        ? JSON.parse(product.variants) 
        : product.variants;
      
      console.log(`\nTotal variants: ${variants.length}\n`);
      
      variants.forEach((v, i) => {
        const size = v.size || '?';
        const parts = size.split('|');
        const form = parts[0] || '?';
        const weight = parts[1] || '?';
        
        console.log(`  ${i + 1}. Форма: "${form}" | Вага: "${weight}" | Ціна: ${v.price} грн`);
      });
      
      console.log('\n');
    } catch (e) {
      console.log('Failed to parse variants\n');
    }
  });
  
  // Анализируем паттерны
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PATTERN ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const allForms = new Set();
  const allCombinations = new Set();
  
  withVariants.forEach(product => {
    try {
      const variants = typeof product.variants === 'string' 
        ? JSON.parse(product.variants) 
        : product.variants;
      
      variants.forEach(v => {
        const size = v.size || '';
        const parts = size.split('|');
        if (parts.length === 2) {
          allForms.add(parts[0]);
          allCombinations.add(size);
        }
      });
    } catch (e) {}
  });
  
  console.log('Unique forms:', Array.from(allForms).sort());
  console.log('\nAll combinations:');
  Array.from(allCombinations).sort().forEach(c => console.log(`  - ${c}`));
}

checkAllVariants().catch(console.error);
