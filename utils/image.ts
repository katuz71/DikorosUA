import { API_URL } from '../config/api';

/**
 * Парсит изображения из разных форматов
 * Поддерживает: JSON-массив в строке, строку с запятыми, один URL
 * @param imagesData - данные изображений (строка или массив)
 * @returns массив URL изображений
 */
export const parseImages = (imagesData: string | string[] | null | undefined): string[] => {
  if (!imagesData) return [];
  
  // Если уже массив
  if (Array.isArray(imagesData)) {
    return imagesData.map(url => String(url).trim()).filter(url => url);
  }
  
  const str = String(imagesData).trim();
  if (!str) return [];
  
  // Если это JSON массив в виде строки
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map(url => String(url).trim()).filter(url => url);
      }
    } catch (e) {
      console.error('Failed to parse images JSON:', str, e);
    }
  }
  
  // Если обычная строка с запятыми
  if (str.includes(',')) {
    return str.split(',').map(url => url.trim()).filter(url => url);
  }
  
  // Один URL
  return [str];
};

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
): string => {
  // Если путь пустой, возвращаем заглушку
  const placeholder = 'https://via.placeholder.com/300';

  if (!path) return placeholder;

  let safePath = path.trim();
  if (!safePath) return placeholder;
  
  // Если это JSON массив в виде строки, парсим и берем первый элемент
  if (safePath.startsWith('[') && safePath.endsWith(']')) {
    try {
      const parsed = JSON.parse(safePath);
      if (Array.isArray(parsed) && parsed.length > 0) {
        safePath = String(parsed[0] ?? '').trim();
      }
    } catch (e) {
      console.error('Failed to parse image array:', safePath);
    }
  }
  
  // Если это data URL (base64), возвращаем как есть
  if (!safePath) return placeholder;

  if (safePath.startsWith('data:')) {
    return safePath;
  }
  
  // Если это внешний URL, возвращаем как есть
  if (safePath.startsWith('http://') || safePath.startsWith('https://')) {
    return safePath;
  }
  
  // Для относительных путей: объединяем API_URL с путем, избегая двойных слешей
  const cleanPath = safePath.startsWith('/') ? safePath.slice(1) : safePath;
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const fullUrl = `${baseUrl}/${cleanPath}`;
  
  return fullUrl;
};

