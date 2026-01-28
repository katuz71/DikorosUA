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

const FAVORITES_KEY = '@favorites';

/**
 * Загрузить избранное из AsyncStorage
 */
export const loadFavorites = async (): Promise<Product[]> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    if (data) {
      return JSON.parse(data) as Product[];
    }
    return [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
};

/**
 * Сохранить избранное в AsyncStorage
 */
export const saveFavorites = async (favorites: Product[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorites:', error);
    throw error;
  }
};

/**
 * Добавить товар в избранное
 */
export const addToFavorites = async (product: Product): Promise<void> => {
  try {
    const favorites = await loadFavorites();
    if (!favorites.some(f => f.id === product.id)) {
      favorites.push(product);
      await saveFavorites(favorites);
    }
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
};

/**
 * Удалить товар из избранного
 */
export const removeFromFavorites = async (productId: number): Promise<void> => {
  try {
    const favorites = await loadFavorites();
    const filtered = favorites.filter(f => f.id !== productId);
    await saveFavorites(filtered);
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
};

/**
 * Проверить, находится ли товар в избранном
 */
export const isFavorite = async (productId: number): Promise<boolean> => {
  try {
    const favorites = await loadFavorites();
    return favorites.some(f => f.id === productId);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
};

/**
 * Переключить состояние избранного
 */
export const toggleFavorite = async (product: Product): Promise<boolean> => {
  try {
    const favorites = await loadFavorites();
    const exists = favorites.some(f => f.id === product.id);
    if (exists) {
      await removeFromFavorites(product.id);
      return false;
    } else {
      await addToFavorites(product);
      return true;
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
};

/**
 * Очистить все избранное
 */
export const clearAllFavorites = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FAVORITES_KEY);
  } catch (error) {
    console.error('Error clearing all favorites:', error);
    throw error;
  }
};

