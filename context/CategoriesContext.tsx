import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config/api';

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
      const url = `${API_URL}/all-categories`;
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
      const list = Array.isArray(data) ? data : [];
      setCategories(list.map((r: any) => ({ id: Number(r.id), name: String(r.name || ''), banner_url: r.banner_url ? String(r.banner_url) : undefined, banners: Array.isArray(r.banners) ? r.banners.map(String) : [] })));
    } catch (e) {
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
