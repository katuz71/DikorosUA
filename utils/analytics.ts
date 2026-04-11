import { API_URL } from '@/config/api';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';
import { AppEventsLogger } from 'react-native-fbsdk-next';

export const trackEvent = async (eventName: string, properties: any = {}) => {
  try {
    const phone = await AsyncStorage.getItem('userPhone');
    const user_data = {
        phone: phone || undefined,
        user_agent: 'Mobile App',
    };
    
    // 1. Отправка на наш бэкенд
    fetch(`${API_URL}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event_name: eventName,
            properties,
            user_data
        })
    }).catch(err => console.log('[Analytics Error]', err));
    
    // 2. Отправка в Firebase (GA4)
    try {
        await analytics().logEvent(eventName, properties);
    } catch (firebaseErr) {
        console.log('[Firebase Error]', firebaseErr);
    }

    // 3. Отправка в Facebook Pixel (Специально адаптировано под строгий FB SDK)
    try {
        // Создаем копию свойств, чтобы не сломать логику для бэкенда и Firebase
        const fbProperties: any = { ...properties };

        // Facebook не принимает массивы объектов! Переделываем items в плоскую строку
        if (fbProperties.items && Array.isArray(fbProperties.items)) {
            if (fbProperties.items.length > 0) {
                // Превращаем массив ID в строку: "123,456"
                fbProperties.content_ids = fbProperties.items.map((i: any) => String(i.item_id)).join(',');
                fbProperties.content_type = 'product';
            }
            // Обязательно удаляем оригинальный массив, иначе Facebook SDK заблокирует отправку
            delete fbProperties.items;
        }

        // Для надежности убираем вообще все возможные вложенные объекты и массивы
        Object.keys(fbProperties).forEach(key => {
            if (typeof fbProperties[key] === 'object' && fbProperties[key] !== null) {
                delete fbProperties[key];
            }
        });

        if (eventName === 'purchase') {
            const amount = Number(properties.value) ?? 0;
            const currency = (properties.currency ?? AnalyticsParams.CURRENCY).toString();
            // Отправляем покупку с очищенными параметрами
            AppEventsLogger.logPurchase(amount, currency, fbProperties);
        } else {
            const valueToSum = properties.value ? Number(properties.value) : 0;
            // Отправляем обычное событие с очищенными параметрами
            AppEventsLogger.logEvent(eventName, valueToSum, fbProperties);
        }
    } catch (fbErr) {
        console.log('[Facebook Error]', fbErr);
    }
    
    console.log(`📊 [Analytics] ${eventName}`, properties);
  } catch (e) {
    console.log('[Analytics] Fatal Error:', e);
  }
};

// --- E-commerce функции для Google Ads и Facebook ---

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