import { API_URL } from '../config/api';

export const checkServerHealth = async (): Promise<boolean> => {
  try {
    // В проде /health может отсутствовать (404) — это НЕ должно блокировать загрузку товаров.
    // Эта функция должна отвечать только на вопрос: "сервер вообще доступен по сети?"
    const healthUrl = `${API_URL}/health`;
    console.log('🔍 Checking server reachability at:', healthUrl);
    
    // Простая проверка (таймаут 10 секунд)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache' 
      },
    });
    
    clearTimeout(timeoutId);

    // Если сервер отвечает любым HTTP-статусом — сеть/SSL/CORS на этом уровне работают.
    // 404/405 здесь допустимы и не должны ломать приложение.
    if (!response.ok) {
      console.warn('⚠️ Health endpoint responded with status:', response.status);
    } else {
      console.log('✅ Health endpoint OK:', response.status);
    }

    return true;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error('❌ Connection failed: Aborted (timeout)');
    } else {
      console.error('❌ Connection failed:', error?.message ?? String(error));
    }
    return false;
  }
};

export const getConnectionErrorMessage = (): string => {
  return `Не вдалося підключитися до сервера.\n\nАдреса: ${API_URL}\n\nПеревірте:\n1. Сервер/домен доступний (відкривається в браузері)\n2. SSL-сертифікат валідний\n3. Сервер відповідає на /products`;
};