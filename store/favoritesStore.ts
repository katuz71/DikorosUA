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
          
          // Очистка битых записей - удаляем товары без ID или с некорректными данными
          const cleanedFavorites = currentFavorites.filter(fav => 
            fav && fav.id && fav.name && fav.price && fav.image
          );
          
          const isCurrentlyFavorite = cleanedFavorites.some(fav => Number(fav.id) === Number(product.id));
          
          if (isCurrentlyFavorite) {
            // Удаляем из избранного
            return {
              favorites: cleanedFavorites.filter(fav => Number(fav.id) !== Number(product.id))
            };
          } else {
            // Добавляем в избранное
            return {
              favorites: [...cleanedFavorites, product]
            };
          }
        });
      },
      
      isFavorite: (id: number) => {
        if (id === undefined || id === null) return false; // Жесткая проверка
        
        const { favorites } = get();
        return favorites.some(fav => Number(fav.id) === Number(id));
      },
      
      removeFromFavorites: (id: number) => {
        if (id === undefined || id === null) return;
        
        set((state) => ({
          favorites: state.favorites.filter(fav => Number(fav.id) !== Number(id))
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
