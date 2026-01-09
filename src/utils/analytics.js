// Единая отправка событий в Firebase Analytics и Facebook App Events
import analytics from '@react-native-firebase/analytics';
import { AppEventsLogger } from 'react-native-fbsdk-next';

// Основная функция для отслеживания просмотра товара
export const logViewItem = async (product) => {
  const params = {
    item_id: product.id || product.id?.toString(),
    item_name: product.title || product.name,
    currency: 'UAH',
    value: parseFloat(product.price),
    content_type: 'product',
  };

  try {
    // Google Analytics (Firebase)
    await analytics().logViewItem({
      items: [params],
      currency: 'UAH',
      value: parseFloat(product.price),
    });

    // Facebook App Events
    AppEventsLogger.logEvent('fb_mobile_content_view', params.value, params);
  } catch (error) {
    console.error('Analytics error (logViewItem):', error);
  }
};

// Функция добавления в корзину
export const logAddToCart = async (product) => {
  const params = {
    item_id: product.id || product.id?.toString(),
    item_name: product.title || product.name,
    currency: 'UAH',
    value: parseFloat(product.price),
    content_type: 'product',
  };

  try {
    // Google Analytics (Firebase)
    await analytics().logAddToCart({
      items: [params],
      currency: 'UAH',
      value: parseFloat(product.price),
    });

    // Facebook App Events
    AppEventsLogger.logEvent('fb_mobile_add_to_cart', params.value, params);
  } catch (error) {
    console.error('Analytics error (logAddToCart):', error);
  }
};

// Функция начала оформления заказа
export const logBeginCheckout = async (products, totalAmount) => {
  const items = products.map(p => ({
    item_id: p.id?.toString() || p.id,
    item_name: p.title || p.name,
    price: parseFloat(p.price),
    quantity: p.quantity || 1
  }));

  try {
    // Google Analytics (Firebase)
    await analytics().logBeginCheckout({
      value: totalAmount,
      currency: 'UAH',
      items: items,
    });

    // Facebook App Events
    AppEventsLogger.logEvent('InitiateCheckout', totalAmount, {
      currency: 'UAH',
      content_type: 'product',
      num_items: items.length.toString(),
      payment_info_available: '0' 
    });
  } catch (error) {
    console.error('Analytics error (logBeginCheckout):', error);
  }
};

// Функция покупки
export const logPurchase = async (products, totalAmount) => {
  const items = products.map(p => ({
    item_id: p.id?.toString() || p.id,
    item_name: p.title || p.name,
    price: parseFloat(p.price),
    quantity: p.quantity || 1
  }));

  try {
    // Google Analytics (Firebase)
    await analytics().logPurchase({
      value: totalAmount,
      currency: 'UAH',
      items: items,
    });

    // Facebook App Events
    AppEventsLogger.logPurchase(totalAmount, 'UAH', { items: JSON.stringify(items) });
  } catch (error) {
    console.error('Analytics error (logPurchase):', error);
  }
};

