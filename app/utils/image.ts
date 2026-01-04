import { API_URL } from '../config/api';

/**
 * Получает URL изображения с автоматической оптимизацией для локальных файлов
 * @param path - путь к изображению (может быть относительным или полным URL)
 * @param options - опции оптимизации (width, height, quality, format)
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
  if (!path) return 'https://via.placeholder.com/300'; // Заглушка
  
  // Если это внешний URL, возвращаем как есть (не оптимизируем внешние изображения)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Для локальных путей используем оптимизацию
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Определяем, является ли путь локальным файлом (начинается с uploads/ или других локальных путей)
  const isLocalFile = cleanPath.startsWith('uploads/') || 
                     path.startsWith('/uploads/') ||
                     (!path.startsWith('http') && !path.startsWith('//'));
  
  if (isLocalFile) {
    // Извлекаем имя файла из пути
    let filename = cleanPath;
    if (cleanPath.startsWith('uploads/')) {
      filename = cleanPath.replace('uploads/', '');
    } else if (path.startsWith('/uploads/')) {
      filename = path.replace('/uploads/', '');
    } else {
      // Для других локальных путей берем последнюю часть (имя файла)
      const parts = cleanPath.split('/');
      filename = parts[parts.length - 1];
    }
    
    let url = `${API_URL}/image/${filename}`;
    
    // Добавляем параметры оптимизации
    const params: string[] = [];
    if (options?.width) params.push(`w=${options.width}`);
    if (options?.height) params.push(`h=${options.height}`);
    if (options?.quality !== undefined) {
      params.push(`q=${options.quality}`);
    } else {
      // Если качество не указано, используем базовое значение
      params.push('q=85');
    }
    if (options?.format) {
      params.push(`format=${options.format}`);
    } else {
      // По умолчанию используем WebP для лучшего сжатия
      params.push('format=webp');
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return url;
  }
  
  // Для других путей возвращаем как есть (без оптимизации)
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

