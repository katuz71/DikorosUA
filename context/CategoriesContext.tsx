import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL, SERVER_URL } from '../config/api';

export type Category = {
  id: number;
  name: string;
  banner_url?: string;
  banners?: string[];
};

interface CategoriesContextType {
  categories: Category[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType>({
  categories: [],
  isLoading: false,
  refetch: async () => {},
});

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = `${SERVER_URL}/all-categories`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Хорошоп может возвращать список как в корне, так и в поле categories
      const rawList = Array.isArray(data) ? data : (data?.categories || []);
      
      setCategories(rawList.filter(Boolean).map((r: any) => ({ 
        id: Number(r.id || 0), 
        name: String(r.name || 'Категорія'), 
        banner_url: r.banner_url ? String(r.banner_url) : undefined, 
        banners: Array.isArray(r.banners) ? r.banners.map(String) : [] 
      })));
    } catch (e: any) {
      console.warn('Categories fetch failed:', e);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <CategoriesContext.Provider value={{ categories, isLoading, refetch: fetchCategories }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = () => useContext(CategoriesContext);
