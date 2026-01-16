import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoriteProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  category?: string;
  old_price?: number;
  badge?: string;
  unit?: string;
}

interface FavoritesStore {
  favorites: FavoriteProduct[];
  toggleFavorite: (product: FavoriteProduct) => void;
  isFavorite: (id: number) => boolean;
  setFavorites: (products: FavoriteProduct[]) => void;
  clearFavorites: () => void;
  removeFromFavorites: (id: number) => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      
      toggleFavorite: (product: FavoriteProduct) => {
        if (!product?.id) return; // Жесткая проверка
        
        set((state) => {
          const currentFavorites = state.favorites;
          const isCurrentlyFavorite = currentFavorites.some(fav => fav.id === product.id);
          
          if (isCurrentlyFavorite) {
            // Удаляем из избранного
            return {
              favorites: currentFavorites.filter(fav => fav.id !== product.id)
            };
          } else {
            // Добавляем в избранное
            return {
              favorites: [...currentFavorites, product]
            };
          }
        });
      },
      
      isFavorite: (id: number) => {
        if (id === undefined || id === null) return false; // Жесткая проверка
        
        const { favorites } = get();
        return favorites.some(fav => fav.id === id);
      },
      
      removeFromFavorites: (id: number) => {
        if (id === undefined || id === null) return;
        
        set((state) => ({
          favorites: state.favorites.filter(fav => fav.id !== id)
        }));
      },
      
      setFavorites: (products: FavoriteProduct[]) => {
        set({ favorites: products });
      },
      
      clearFavorites: () => {
        set({ favorites: [] });
      },
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
