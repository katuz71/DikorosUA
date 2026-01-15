// Заглушки для аналитики (Firebase и Facebook SDK удалены для Expo Go)
// В будущем можно заменить на Expo Analytics или другие облачные решения

// 1. Просмотр товара
export const logViewItem = async (product) => {
  try {
    console.log('📊 ViewItem (stub):', { 
      name: product.name || product.title, 
      price: product.price || product.currentPrice || 0,
      id: product.id 
    });
  } catch (error) {
    console.log('⚠️ Analytics error (logViewItem):', error);
  }
};

// 2. Добавление в корзину
export const logAddToCart = async (product) => {
  try {
    const qty = product.quantity || 1;
    const price = parseFloat(product.price || product.currentPrice || 0);
    const totalValue = price * qty;
    
    console.log('🛒 AddToCart (stub):', { 
      name: product.name || product.title, 
      quantity: qty, 
      itemPrice: price,
      totalEventValue: totalValue 
    });
  } catch (error) {
    console.log('⚠️ Analytics error (logAddToCart):', error);
  }
};

// 3. Начало оформления (Checkout)
export const logBeginCheckout = async (products, totalAmount) => {
  try {
    console.log('💳 BeginCheckout (stub):', { 
      amount: totalAmount, 
      currency: 'UAH', 
      itemsCount: products.length 
    });
  } catch (error) {
    console.log('⚠️ Analytics error (logBeginCheckout):', error);
  }
};

// 4. Покупка (Purchase)
export const logPurchase = async (products, totalAmount) => {
  try {
    console.log('💰 Purchase (stub):', { 
      transaction_id: String(Date.now()),
      amount: parseFloat(totalAmount), 
      currency: 'UAH', 
      items: products 
    });
  } catch (error) {
    console.log('⚠️ Analytics error (logPurchase):', error);
  }
};

