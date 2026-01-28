import { API_URL } from '../config/api';

/**
 * Получает URL изображения
 * @param path - путь к изображению (может быть относительным или полным URL)
 * @param options - опции (оставлены для обратной совместимости, но не используются)
 */
export const getImageUrl = (
  path: string | null | undefined,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  }
) => {
  // Если путь пустой, возвращаем заглушку
  if (!path) return 'https://via.placeholder.com/300';
  
  // Если это data URL (base64), возвращаем как есть
  if (path.startsWith('data:')) {
    return path;
  }
  
  // Если это внешний URL, возвращаем как есть
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Для относительных путей: объединяем API_URL с путем, избегая двойных слешей
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const fullUrl = `${baseUrl}/${cleanPath}`;
  
  console.log('🔍 getImageUrl:', {
    originalPath: path,
    cleanPath,
    baseUrl,
    fullUrl,
    API_URL
  });
  
  return fullUrl;
};

