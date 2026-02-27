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

const isLikelyCertificateImage = (url: string): boolean => {
  const safe = String(url || '').trim();
  if (!safe) return false;

  // Drop query/hash for keyword checks
  const withoutQuery = safe.split('?')[0].split('#')[0];
  const lower = withoutQuery.toLowerCase();

  // Common certificate keywords (UA/RU/EN) + typical short forms
  return (
    lower.includes('certificate') ||
    lower.includes('certificat') ||
    lower.includes('certifik') ||
    lower.includes('sertifikat') ||
    lower.includes('sertif') ||
    lower.includes('сертифик') ||
    lower.includes('сертифік')
  );
};

/**
 * Picks a primary product image path for cards/lists.
 * Rule: prefer non-certificate images; if none exist, return empty string.
 */
export const pickPrimaryProductImagePath = (
  item: any,
  options?: { allowCertificateFallback?: boolean }
): string => {
  const allowCertificateFallback = Boolean(options?.allowCertificateFallback);

  const candidates: string[] = [];

  // Prefer explicit images list first
  if (item?.images) {
    candidates.push(...parseImages(item.images));
  }

  // Then other common fields
  if (item?.picture) candidates.push(String(item.picture));
  if (item?.image) candidates.push(String(item.image));
  if (item?.image_url) candidates.push(String(item.image_url));

  const cleaned = candidates
    .map((u) => String(u || '').trim())
    .filter((u) => u && u !== 'null' && u !== 'undefined');

  // De-dup while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const u of cleaned) {
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }

  const nonCert = unique.filter((u) => !isLikelyCertificateImage(u));
  if (nonCert.length > 0) return nonCert[0];

  if (allowCertificateFallback && unique.length > 0) return unique[0];
  return '';
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
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;

  // If this is an internal uploads URL and options provided — route through /api/image
  // to avoid decoding huge originals on Android (Fresco hard cap OOM).
  const buildProxyUrl = (srcPath: string) => {
    if (!options) return '';

    const w = Math.max(0, Math.round(Number(options.width || 0)));
    const h = Math.max(0, Math.round(Number(options.height || 0)));
    const q = Math.max(30, Math.min(95, Math.round(Number(options.quality || 80))));
    const fmt = (options.format || 'jpg').toLowerCase();

    const params = new URLSearchParams();
    params.set('src', srcPath);
    if (w) params.set('w', String(w));
    if (h) params.set('h', String(h));
    params.set('q', String(q));
    params.set('format', fmt);

    return `${baseUrl}/api/image?${params.toString()}`;
  };

  if (safePath.startsWith('http://') || safePath.startsWith('https://')) {
    // For our own uploads domain, use proxy when options are provided.
    try {
      const url = new URL(safePath);
      if (options && url.pathname.startsWith('/uploads/')) {
        const proxied = buildProxyUrl(url.pathname);
        if (proxied) return proxied;
      }
    } catch {
      // ignore URL parse
    }
    return safePath;
  }
  
  // Для относительных путей: объединяем API_URL с путем, избегая двойных слешей
  const cleanPath = safePath.startsWith('/') ? safePath.slice(1) : safePath;
  const fullUrl = `${baseUrl}/${cleanPath}`;

  // If it's an uploads path and options provided — use proxy.
  if (options && (safePath.startsWith('/uploads/') || safePath.startsWith('uploads/') || cleanPath.startsWith('uploads/'))) {
    const srcPath = safePath.startsWith('/') ? safePath : `/${safePath}`;
    const proxied = buildProxyUrl(srcPath.startsWith('/uploads/') ? srcPath : `/uploads/${cleanPath.replace(/^uploads\//, '')}`);
    if (proxied) return proxied;
  }

  return fullUrl;
};

