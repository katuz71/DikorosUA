import React, { createContext, useContext, useState, ReactNode } from 'react';

export type OrderItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  packSize: number;
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
};

type OrdersContextType = {
  orders: Order[];
  addOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
  clearOrders: () => void;
};

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
  };

  const removeOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const clearOrders = () => {
    setOrders([]);
  };

  return (
    <OrdersContext.Provider value={{ orders, addOrder, removeOrder, clearOrders }}>
      {children}
    </OrdersContext.Provider>
  );
}

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within an OrdersProvider');
  return context;
};

