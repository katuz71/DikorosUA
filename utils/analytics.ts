import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';

export const trackEvent = async (eventName: string, properties: any = {}) => {
  try {
    const phone = await AsyncStorage.getItem('userPhone');
    const user_data = {
        phone: phone || undefined,
        user_agent: 'Mobile App',
    };
    
    // Fire and forget
    fetch(`${API_URL}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event_name: eventName,
            properties,
            user_data
        })
    }).catch(err => console.log('[Analytics Error]', err));
    
    console.log(`📊 [Analytics] ${eventName}`, JSON.stringify(properties, null, 2));
  } catch (e) {
    console.log('[Analytics] Error:', e);
  }
};

// --- E-commerce функции для Google Ads ---

export const AnalyticsParams = {
  CURRENCY: 'UAH',
};

// Форматирование товара
const formatItem = (product: any, quantity: number = 1) => ({
  item_id: String(product.id),
  item_name: product.name || product.title,
  item_category: product.category || 'general',
  price: Number(product.price),
  quantity: Number(quantity),
});

export const trackViewItem = (product: any) => {
  if (!product) return;
  trackEvent('view_item', {
    currency: AnalyticsParams.CURRENCY,
    value: Number(product.price),
    items: [formatItem(product)],
  });
};

export const trackAddToCart = (product: any, quantity: number = 1) => {
  if (!product) return;
  trackEvent('add_to_cart', {
    currency: AnalyticsParams.CURRENCY,
    value: Number(product.price) * quantity,
    items: [formatItem(product, quantity)],
  });
};

export const trackRemoveFromCart = (product: any, quantity: number = 1) => {
  if (!product) return;
  trackEvent('remove_from_cart', {
    currency: AnalyticsParams.CURRENCY,
    value: Number(product.price) * quantity,
    items: [formatItem(product, quantity)],
  });
};

export const trackAddToFavorites = (product: any) => {
  if (!product) return;
  trackEvent('add_to_wishlist', {
    currency: AnalyticsParams.CURRENCY,
    value: Number(product.price),
    items: [formatItem(product)],
  });
};

/** Вызывать сразу после первого входа через Google (когда бэкенд вернул needs_phone). */
export const trackSignUp = (method: string = 'Google') => {
  const props = {
    method,
    bonus_amount: 150,
    currency: AnalyticsParams.CURRENCY,
  };
  trackEvent('sign_up', props);
  logFirebaseEvent('sign_up', props).catch(() => {});
};

export const trackViewCart = (cartItems: any[], totalPrice: number) => {
  if (!cartItems || cartItems.length === 0) return;
  trackEvent('view_cart', {
    currency: AnalyticsParams.CURRENCY,
    value: Number(totalPrice),
    items: cartItems.map(item => formatItem(item, item.quantity || 1)),
  });
};

export const trackBeginCheckout = (cartItems: any[], totalPrice: number, coupon?: string) => {
  if (!cartItems || cartItems.length === 0) return;
  const properties: any = {
    currency: AnalyticsParams.CURRENCY,
    value: Number(totalPrice),
    items: cartItems.map(item => formatItem(item, item.quantity || 1)),
  };
  if (coupon) properties.coupon = coupon;

  trackEvent('begin_checkout', properties);
};

export const trackPurchase = (transactionId: string | number, cartItems: any[], totalPrice: number, shipping: number = 0, coupon?: string) => {
  if (!cartItems || cartItems.length === 0) return;
  const properties: any = {
    transaction_id: String(transactionId),
    currency: AnalyticsParams.CURRENCY,
    value: Number(totalPrice),
    shipping: Number(shipping),
    items: cartItems.map(item => formatItem(item, item.quantity || 1)),
  };
  if (coupon) properties.coupon = coupon;

  trackEvent('purchase', properties);
};
