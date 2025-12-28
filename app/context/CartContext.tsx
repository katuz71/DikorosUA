import React, { createContext, ReactNode, useContext, useState } from 'react';

// Типы
export type CartItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  packSize: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: any, packSize: number) => void;
  removeItem: (id: number, packSize: number) => void;
  updateQuantity: (id: number, packSize: number, change: number) => void;
  clearCart: () => void;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: any, packSize: number) => {
    console.log('addItem called:', product.name, 'packSize:', packSize);
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.packSize === packSize);
      if (existing) {
        const updated = prev.map((item) =>
          item.id === product.id && item.packSize === packSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        console.log('Updated existing item, new items:', updated);
        return updated;
      }
      const newItems = [...prev, { ...product, quantity: 1, packSize }];
      console.log('Added new item, new items:', newItems);
      return newItems;
    });
  };

  const removeItem = (id: number, packSize: number) => {
    setItems((prev) => prev.filter((item) => !(item.id === id && item.packSize === packSize)));
  };

  const updateQuantity = (id: number, packSize: number, change: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.packSize === packSize) {
          const newQty = Math.max(1, item.quantity + change);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => setItems([]);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};