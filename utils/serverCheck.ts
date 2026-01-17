import { API_URL } from '../app/config/api';

/**
 * Проверяет доступность сервера
 * @returns Promise<boolean> - true если сервер доступен, false если нет
 */
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking server health at:', `${API_URL}/health`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Увеличили до 10 секунд
    
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    console.log('✅ Server health check successful:', response.status);
    return response.ok;
  } catch (error: any) {
    console.error('❌ Server health check failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      API_URL
    });
    
    // Альтернативная проверка через /products
    try {
      console.log('🔄 Trying alternative check via /products');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_URL}/products`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('✅ Alternative check successful:', response.status);
      return response.ok;
    } catch (altError) {
      console.error('❌ Alternative check also failed:', altError);
      return false;
    }
  }
};

/**
 * Получает понятное сообщение об ошибке подключения
 */
export const getConnectionErrorMessage = (): string => {
  return `Не вдалося підключитися до сервера.\n\nПеревірте:\n1. Сервер запущений на ${API_URL}\n2. Пристрій і комп'ютер в одній мережі\n3. Фаєрвол не блокує з'єднання\n4. IP адрес правильний (може змінитися)`;
};





