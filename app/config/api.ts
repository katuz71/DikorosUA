// Определяем API URL в зависимости от окружения
const getApiUrl = (): string => {
  // ВАЖНО: Для мобильной разработки нужно использовать IP компьютера, а не localhost
  // localhost в мобильном приложении указывает на само устройство, а не на компьютер
  const LOCAL_API_URL = 'http://192.168.0.103:8001';
  
  // В продакшене используем домен
  const PROD_API_URL = 'https://dikoros.store';
  
  // Определяем окружение
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.EXPO_PUBLIC_ENVIRONMENT === 'production';
  
  // Для разработки используем IP компьютера, для продакшена - домен
  const apiUrl = isProduction ? PROD_API_URL : LOCAL_API_URL;
  
  console.log('🔧 API URL configured:', {
    isProduction,
    apiUrl,
    nodeEnv: process.env.NODE_ENV,
    expoEnv: process.env.EXPO_PUBLIC_ENVIRONMENT
  });
  
  return apiUrl;
};

export const API_URL = getApiUrl();

// Экспортируем базовые эндпоинты
export const API_ENDPOINTS = {
  products: '/products',
  categories: '/categories',
  orders: '/orders',
  upload: '/upload',
  health: '/',
  admin: '/admin',
};




