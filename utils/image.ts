import { API_URL } from '../config/api';

/**
 * Безопасно отрезаем /api из конца ссылки, если оно там есть
 */
const getBaseDomain = (): string => {
  if (!API_URL) return 'https://dikoros.ua';
  let clean = String(API_URL).trim();
  // Убираем слэш на конце, если есть
  if (clean.endsWith('/')) clean = clean.slice(0, -1);
  // Убираем /api, чтобы остался только чистый домен
  if (clean.endsWith('/api')) clean = clean.slice(0, -4);
  return clean;
};

export function ensureHttps(url: string | null | undefined): string {
  if (url == null || typeof url !== 'string') return '';
  const s = url.trim();
  if (!s || s.startsWith('data:')) return s;
  if (s.toLowerCase().startsWith('http://')) return 'https://' + s.slice(7);
  return s;
}

const addDomain = (path: string): string => {
  const s = String(path).trim();
  if (!s || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return ensureHttps(s);
  }
  const domain = getBaseDomain();
  const cleanPath = s.startsWith('/') ? s.slice(1) : s;
  return ensureHttps(`${domain}/${cleanPath}`);
};

export const getImageUrl = (path: any, options?: any): string => {
  const placeholder = 'https://via.placeholder.com/300';
  if (!path) return placeholder;

  let safePath = '';
  // Защита, если пришел массив
  if (Array.isArray(path)) {
    if (path.length === 0) return placeholder;
    safePath = String(path[0]);
  } else {
    safePath = String(path);
  }

  safePath = safePath.trim();
  if (!safePath) return placeholder;

  // Защита от строкового JSON-массива
  if (safePath.startsWith('[') && safePath.endsWith(']')) {
    try {
      const parsed = JSON.parse(safePath);
      if (Array.isArray(parsed) && parsed.length > 0) {
        safePath = String(parsed[0] ?? '').trim();
      }
    } catch (e) {}
  }

  if (!safePath) return placeholder;
  if (safePath.startsWith('data:')) return safePath;

  return addDomain(safePath) || placeholder;
};

/** Извлекает URL из элемента: строка или объект с полями url/src/image */
function getUrlFromImageElement(el: any): string {
  if (el == null) return '';
  if (typeof el === 'string') return el.trim();
  const url = el?.url ?? el?.src ?? el?.image ?? el?.path ?? '';
  return String(url).trim();
}

export const parseImages = (imagesData: any): string[] => {
  if (!imagesData) return [];
  
  if (Array.isArray(imagesData)) {
    return imagesData
      .map((el) => getUrlFromImageElement(el))
      .filter((u) => u)
      .map((u) => addDomain(u));
  }
  
  const str = String(imagesData).trim();
  if (!str) return [];
  
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed
          .map((el: any) => getUrlFromImageElement(el))
          .filter((u: string) => u)
          .map((u: string) => addDomain(u));
      }
    } catch (e) {}
  }
  
  if (str.includes(',')) {
    return str.split(',').map((url) => addDomain(url.trim())).filter((url) => url);
  }
  
  return [addDomain(str)];
};

const isLikelyCertificateImage = (url: string): boolean => {
  const safe = String(url || '').trim();
  if (!safe) return false;
  const withoutQuery = safe.split('?')[0].split('#')[0];
  const lower = withoutQuery.toLowerCase();
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

export const pickPrimaryProductImagePath = (
  item: any,
  options?: { allowCertificateFallback?: boolean }
): string => {
  const allowCertificateFallback = Boolean(options?.allowCertificateFallback);
  const candidates: string[] = [];

  if (item?.images) candidates.push(...parseImages(item.images));
  if (item?.picture) candidates.push(addDomain(String(item.picture)));
  if (item?.image) candidates.push(addDomain(String(item.image)));
  if (item?.image_url) candidates.push(addDomain(String(item.image_url)));
  if (item?.thumbnail) candidates.push(addDomain(String(item.thumbnail)));
  if (item?.imageUrl) candidates.push(addDomain(String(item.imageUrl)));

  const cleaned = candidates
    .map((u) => String(u || '').trim())
    .filter((u) => u && u !== 'null' && u !== 'undefined' && u !== 'https://via.placeholder.com/300');

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