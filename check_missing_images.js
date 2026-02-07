// Проверка товаров без изображений

console.log('🔍 Поиск товаров без изображений в API...\n');

fetch('https://app.dikoros.ua/products')
  .then(r => r.json())
  .then(products => {
    console.log(`📊 Всего товаров: ${products.length}\n`);
    
    // Проверяем каждый товар на наличие изображений
    const withoutImages = products.filter(p => {
      const hasImages = p.images && p.images.length > 0 && p.images !== '[]';
      const hasImage = p.image && p.image.length > 0;
      const hasImageUrl = p.image_url && p.image_url.length > 0;
      const hasPicture = p.picture && p.picture.length > 0;
      
      return !hasImages && !hasImage && !hasImageUrl && !hasPicture;
    });
    
    console.log(`❌ Товаров БЕЗ изображений: ${withoutImages.length}`);
    
    if (withoutImages.length > 0) {
      console.log('\n⚠️ Товары без изображений:\n');
      withoutImages.slice(0, 10).forEach(p => {
        console.log(`   ID: ${p.id} | ${p.name}`);
        console.log(`      images: ${p.images}`);
        console.log(`      image: ${p.image}`);
        console.log(`      image_url: ${p.image_url}`);
        console.log(`      picture: ${p.picture}`);
        console.log('');
      });
      
      if (withoutImages.length > 10) {
        console.log(`   ... и ещё ${withoutImages.length - 10} товаров\n`);
      }
    }
    
    // Проверяем товары с пустыми JSON-массивами
    const withEmptyArrays = products.filter(p => p.images === '[]');
    console.log(`\n🔸 Товаров с пустым массивом изображений '[]': ${withEmptyArrays.length}`);
    
    if (withEmptyArrays.length > 0) {
      console.log('\nПримеры:\n');
      withEmptyArrays.slice(0, 5).forEach(p => {
        console.log(`   ID: ${p.id} | ${p.name}`);
        console.log(`      images: ${p.images}`);
        console.log(`      fallback image: ${p.image || p.image_url || 'НЕТ'}`);
        console.log('');
      });
    }
    
    // Статистика по полям изображений
    console.log('\n📈 Статистика по полям изображений:');
    const stats = {
      hasImages: products.filter(p => p.images && p.images !== '[]').length,
      hasImage: products.filter(p => p.image).length,
      hasImageUrl: products.filter(p => p.image_url).length,
      hasPicture: products.filter(p => p.picture).length,
    };
    
    console.log(`   images (заполнено): ${stats.hasImages} (${(stats.hasImages/products.length*100).toFixed(1)}%)`);
    console.log(`   image (заполнено): ${stats.hasImage} (${(stats.hasImage/products.length*100).toFixed(1)}%)`);
    console.log(`   image_url (заполнено): ${stats.hasImageUrl} (${(stats.hasImageUrl/products.length*100).toFixed(1)}%)`);
    console.log(`   picture (заполнено): ${stats.hasPicture} (${(stats.hasPicture/products.length*100).toFixed(1)}%)`);
    
  })
  .catch(err => {
    console.error('❌ Ошибка:', err.message);
  });
