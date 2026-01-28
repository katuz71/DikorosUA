// Определяем API URL в зависимости от окружения
const getApiUrl = (): string => {
  // 1. IP вашего компьютера (тот, который сработал в браузере!)
  const LOCAL_API_URL = 'http://192.168.0.102:8001';
  
  // 2. Домен для продакшена
  const PROD_API_URL = 'https://dikoros.store';

  // 3. Проверка окружения
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.EXPO_PUBLIC_ENVIRONMENT === 'production';
  
  const apiUrl = isProduction ? PROD_API_URL : LOCAL_API_URL;
  
  console.log('🔧 Using API URL:', apiUrl); // Посмотрите в консоль, что здесь выводится
  return apiUrl;
};

export const API_URL = getApiUrl();

// 🔥 ВАЖНО: Эндпоинты исправлены под ваш main.py
export const API_ENDPOINTS = {
  products: '/products',          // Было верно
  categories: '/all-categories',  // ИСПРАВЛЕНО (в сервере /all-categories, а было /categories)
  createOrder: '/create_order',   // ИСПРАВЛЕНО (в сервере /create_order)
  userOrders: '/orders/user',     // ИСПРАВЛЕНО (для истории заказов)
  upload: '/upload',              // Было верно
  health: '/health',              // ИСПРАВЛЕНО (было /)
  admin: '/admin',                // Было верно
};