// Определяем API URL в зависимости от окружения
const getApiUrl = (): string => {
  // ВАЖНО: Для локальной разработки замените IP на ваш локальный адрес
  // Как узнать свой IP:
  // - Windows: ipconfig в командной строке, ищите "IPv4 Address"
  // - Mac/Linux: ifconfig или ip addr, ищите "inet"
  // - Формат: http://192.168.X.X:8001 (где 8001 - порт бэкенда)
  const LOCAL_API_URL = 'http://192.168.0.102:8001';
  
  // В продакшене используем домен
  const PROD_API_URL = 'https://dikoros.store';
  
  // Определяем окружение
  const isProduction = process.env.NODE_ENV === 'production' || 
                      process.env.EXPO_PUBLIC_ENVIRONMENT === 'production';
  
  // Для разработки используем локальный IP, для продакшена - домен
  return isProduction ? PROD_API_URL : LOCAL_API_URL;
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




