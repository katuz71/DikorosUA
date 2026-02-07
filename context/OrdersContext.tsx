import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config/api';
import { checkServerHealth, getConnectionErrorMessage } from '../utils/serverCheck';

export interface Variant {
  size: string;
  price: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  images?: string;  // Multiple images through comma separation
  image_url?: string;  // Alternative image field name from API/CSV
  picture?: string;  // Alternative image field name from API/XML
  description?: string;
  category?: string;
  // New fields
  weight?: string;
  composition?: string;
  usage?: string;
  pack_sizes?: string[] | string;  // Can be array or JSON string depending on source
  old_price?: number;  // For discount logic
  unit?: string;  // Measurement unit (e.g., "шт", "г", "мл")
  option_names?: string;  // Variation dimension titles (e.g., "weight|form|sort")
  variationGroups?: any[];  // Advanced variation groups (multi-dimensional)
  variants?: any;  // Variants with different prices (can be array or JSON string)
}

export type OrderItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  packSize: string; // Changed to string to support "30", "60"
  variant_info?: string | null; // Variant size information (e.g., "10 шт", "100 г")
};

export type Order = {
  id: string;
  date: string;
  items: OrderItem[];
  total: number;
  city?: string;
  warehouse?: string;
  phone?: string;
  name?: string;
  user_name?: string; // Added for server sync
};

interface OrdersContextType {
  // Product Data
  products: Product[];
  fetchProducts: () => Promise<void>;
  isLoading: boolean;
  
  // Order Data
  orders: Order[];
  addOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
  clearOrders: () => void;
}

const OrdersContext = createContext<OrdersContextType>({
  products: [],
  fetchProducts: async () => {},
  isLoading: false,
  orders: [],
  addOrder: () => {},
  removeOrder: () => {},
  clearOrders: () => {},
});

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  // --- PRODUCTS STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      // Не блокируем загрузку товаров проверкой /health.
      // /health может быть недоступен/медленный/отсутствовать, при этом /products может работать.
      // Проверку оставляем как диагностическую (лог), но всегда пробуем /products.
      checkServerHealth().catch(() => {});
      
      const productsUrl = `${API_URL}/products`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд timeout (на медленных сетях 10с часто мало)
      
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // Ensure data is always an array
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.warn("API returned non-array data, using empty array");
        setProducts([]);
      }
    } catch (error: any) {
      console.error("🔥 FETCH ERROR:", error);
      console.error("Error fetching products:", error);
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        type: typeof error,
        stack: error.stack
      });
      
      // More detailed error logging
      if (error.name === 'AbortError') {
        console.error("⏱️ Request timeout - Server is too slow to respond");
        console.error("⏱️ URL:", `${API_URL}/products`);
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        console.error("🌐 Network error - Server may not be running");
        console.error(getConnectionErrorMessage());
      }
      
      // Ensure products is always an array even on error
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load products on startup
  useEffect(() => {
    fetchProducts();
  }, []);

  // --- ORDERS STATE ---
  const [orders, setOrders] = useState<Order[]>([]);

  const addOrder = (order: Order) => {
    setOrders((prev: Order[]) => [order, ...prev]);
  };

  const removeOrder = (id: string) => {
    setOrders((prev: Order[]) => prev.filter((o: Order) => o.id !== id));
  };

  const clearOrders = () => {
    setOrders([]);
  };

  return (
    <OrdersContext.Provider value={{ 
      products, fetchProducts, isLoading,
      orders, addOrder, removeOrder, clearOrders 
    }}>
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => useContext(OrdersContext);
