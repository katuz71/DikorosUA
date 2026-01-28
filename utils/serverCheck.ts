import { API_URL } from '../config/api';

export const checkServerHealth = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking server health at:', `${API_URL}/health`);
    
    // Простая проверка (таймаут 5 секунд)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache' 
      },
    });
    
    clearTimeout(timeoutId);

    if (response.status === 404) {
        console.error('❌ ОШИБКА: Сервер доступен, но нет маршрута /health в main.py');
        return false;
    }

    console.log('✅ Server responding:', response.status);
    return response.ok; // Вернет true только если статус 200-299
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
};

export const getConnectionErrorMessage = (): string => {
  return `Не вдалося підключитися до сервера.\n\nАдреса: ${API_URL}\n\nПеревірте:\n1. Сервер Python запущений\n2. Телефон і ПК в одній Wi-Fi мережі\n3. В main.py додано @app.get("/health")`;
};