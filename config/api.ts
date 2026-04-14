// Определяем API URL в зависимости от окружения
const getBaseUrl = (): string => {
  // 1. Production URL as hard fallback (ROOT domain)
  const PROD_URL = 'https://app.dikoros.ua';

  // 2. Use environment override if set (e.g. from EAS secrets or .env)
  if (process.env.EXPO_PUBLIC_API_URL) {
    // Если в env пришел URL с /api, отрезаем его для унификации
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
  }

  return PROD_URL;
};

// API_URL теперь указывает на КОРЕНЬ сервера (https://app.dikoros.ua)
// Это исправляет 404 ошибки в эндпоинтах, которые не на /api (banners, all-categories)
// и исправляет 404 ошибки (double-api) в эндпоинтах, которые уже включают /api
export const API_URL = getBaseUrl();
// SERVER_URL - синоним API_URL для обратной совместимости с моими недавними правками
export const SERVER_URL = API_URL;

// 🔥 ВАЖНО: Эндпоинты в main.py могут быть как с /api, так и без
export const API_ENDPOINTS = {
  products: '/api/products',      
  categories: '/all-categories',  
  banners: '/banners',            
  createOrder: '/create_order',   
  userOrders: '/api/client/orders', 
  upload: '/upload',              
  health: '/health',              
  admin: '/admin',                
};

/**
 * Хелпер для получения полного URL картинки
 */
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Если путь уже содержит /api/uploads/ или /uploads/, не дублируем корень с /api
  return `${API_URL}${cleanPath}`;
};