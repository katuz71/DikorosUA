import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Product {
  id: number;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  picture?: string;
  category?: string;
  rating?: number;
  size?: string;
  description?: string;
  badge?: string;
  quantity?: number;
  composition?: string;
  usage?: string;
  weight?: string;
  pack_sizes?: string[];
  old_price?: number;
  unit?: string;
  variants?: any[];
}

const HISTORY_KEY = '@viewed_history';
const MAX_HISTORY_LENGTH = 15;

/**
 * Получить историю просмотренных товаров из AsyncStorage
 */
export const getHistory = async (): Promise<Product[]> => {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (data) {
      return JSON.parse(data) as Product[];
    }
    return [];
  } catch (error) {
    console.error('Error loading view history:', error);
    return [];
  }
};

/**
 * Сохранить историю в AsyncStorage
 */
const saveHistory = async (history: Product[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving view history:', error);
    throw error;
  }
};

/**
 * Добавить товар в историю просмотров:
 * - Добавляет в начало списка
 * - Удаляет дубликат по id (если был — товар поднимается наверх)
 * - Ограничивает длину списка до 15 элементов
 */
export const addToHistory = async (product: Product): Promise<void> => {
  try {
    const history = await getHistory();
    const withoutDuplicate = history.filter((p) => p.id !== product.id);
    const newHistory = [product, ...withoutDuplicate].slice(0, MAX_HISTORY_LENGTH);
    await saveHistory(newHistory);
  } catch (error) {
    console.error('Error adding to view history:', error);
    throw error;
  }
};

/**
 * Удалить товар з історії перегляду за id
 */
export const removeFromHistory = async (productId: number): Promise<void> => {
  try {
    const history = await getHistory();
    const filtered = history.filter((p) => p.id !== productId);
    await saveHistory(filtered);
  } catch (error) {
    console.error('Error removing from view history:', error);
    throw error;
  }
};
