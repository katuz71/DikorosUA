import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  packSize: string;
  unit?: string; // Unit of measurement (e.g., "шт", "г", "мл")
  variantSize?: string; // Variant size for unique identification
}

interface CartContextType {
  items: CartItem[];
  
  // ADDING: Supports both names
  addToCart: (product: any, quantity: number, packSize: string, customUnit?: string, customPrice?: number) => void;
  addItem: (product: any, quantity: number, packSize: string, customUnit?: string, customPrice?: number) => void;
  
  // REMOVING: Supports both names
  removeFromCart: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  
  // QUANTITY MANAGEMENT: Match by id AND unit
  addOne: (id: number, unit: string) => void;
  removeOne: (id: number, unit: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;

  // Abandoned cart notification (local Expo)
  cancelCartNotification: () => Promise<void>;
  
  // PROMO CODE SUPPORT
  discount: number;
  discountAmount: number;
  appliedPromoCode: string;
  setPromoDiscount: (discount: number, discountAmount: number, promoCode: string) => void;
  clearPromoDiscount: () => void;
  finalPrice: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  addItem: () => {},
  removeFromCart: () => {},
  removeItem: () => {},
  addOne: () => {},
  removeOne: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalPrice: 0,
  cancelCartNotification: async () => {},
  discount: 0,
  discountAmount: 0,
  appliedPromoCode: '',
  setPromoDiscount: () => {},
  clearPromoDiscount: () => {},
  finalPrice: 0,
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const cartNotificationId = useRef<string | null>(null);
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;

  const cancelCartNotification = async () => {
    if (cartNotificationId.current) {
      try {
        console.log("❌ Локальный пуш ОТМЕНЕН, ID:", cartNotificationId.current);
        await Notifications.cancelScheduledNotificationAsync(cartNotificationId.current);
      } finally {
        cartNotificationId.current = null;
      }
    }
  };

  const scheduleCartNotification = async () => {
    const currentItems = itemsRef.current;
    console.log("🚀 Попытка запустить scheduleCartNotification...");
    if (currentItems.length === 0) return;
    try {
      if (cartNotificationId.current) {
        await Notifications.cancelScheduledNotificationAsync(cartNotificationId.current);
        cartNotificationId.current = null;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      console.log("📊 Статус разрешений на уведомления:", finalStatus);
      if (finalStatus !== 'granted') {
        console.log("❌ Разрешения не получены, выходим");
        return;
      }
      const firstItemName = currentItems[0]?.name || 'товари';
      const bodyText = currentItems.length > 1
        ? `Ви залишили ${firstItemName} та інші смачні дикороси в кошику. Повертайтесь, щоб оформити замовлення!`
        : `Ви залишили ${firstItemName} в кошику. Повертайтесь, щоб оформити замовлення!`;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Покинутий кошик',
          body: bodyText,
          data: { type: 'abandoned_cart', url: '/(tabs)/cart' },
        },
        trigger: { type: 'timeInterval' as const, seconds: 7200 },
      });
      cartNotificationId.current = id;
      console.log("✅ Локальный пуш ЗАПЛАНИРОВАН на 2 год, ID:", id);
    } catch (error) {
      console.error("🚨 ОШИБКА ПЛАНИРОВАНИЯ:", error);
      cartNotificationId.current = null;
    }
  };

  useEffect(() => {
    if (items.length === 0 && cartNotificationId.current !== null) {
      cancelCartNotification();
    }
  }, [items.length]);

  // --- ADD LOGIC ---
  const addToCart = (product: any, quantity: number, packSize: string, customUnit?: string, customPrice?: number) => {
    console.log("🛒 Вызвана функция addToCart, запускаю пуш...");
    InteractionManager.runAfterInteractions(() => scheduleCartNotification());
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    // Determine the unit to use: customUnit (if provided) > product.unit > "шт"
    const unitToUse = customUnit || product.unit || "шт";
    // Use packSize if provided, otherwise use unitToUse as fallback
    const safePackSize = packSize || unitToUse;
    // Use customPrice if provided (for variants), otherwise use product.price
    const finalPrice = customPrice !== undefined ? customPrice : product.price;
    // Use packSize as variantSize for unique identification
    const variantSize = safePackSize;

    setItems((currentItems) => {
      // Find existing item by id AND variantSize (for variants) or unit (for legacy)
      // Items with different variants should be separate entries
      const existingIndex = currentItems.findIndex(
        (item) => {
          // Match by id
          if (item.id !== product.id) return false;
          
          // If variantSize is provided, match by variantSize
          if (variantSize && item.variantSize) {
            return item.variantSize === variantSize;
          }
          
          // Legacy matching by unit
          return (item.unit || item.packSize || "шт") === unitToUse;
        }
      );

      if (existingIndex > -1) {
        const newItems = [...currentItems];
        newItems[existingIndex].quantity += quantity;
        itemsRef.current = newItems;

        // Analytics (Update existing)
        logFirebaseEvent('add_to_cart', {
            currency: 'UAH',
            value: newItems[existingIndex].price * quantity,
            items: [{ 
              item_id: String(newItems[existingIndex].id), 
              item_name: newItems[existingIndex].name, 
              price: newItems[existingIndex].price,
              quantity: quantity 
            }]
        });

        return newItems;
      } else {
        const newItem = {
          id: product.id,
          name: product.name,
          price: finalPrice, // Use custom price for variants
          image: product.image,
          quantity: quantity,
          packSize: safePackSize,
          unit: unitToUse, // Set unit field from customUnit or product.unit or "шт"
          variantSize: variantSize, // Store variant size for unique identification
        };
        
        // Analytics (New item)
        logFirebaseEvent('add_to_cart', {
            currency: 'UAH',
            value: newItem.price * quantity,
            items: [{ 
              item_id: String(newItem.id), 
              item_name: newItem.name, 
              price: newItem.price,
              quantity: quantity 
            }]
        });

        const newItems = [...currentItems, newItem];
        itemsRef.current = newItems;
        return newItems;
      }
    });
  };

  // Alias for backward compatibility
  const addItem = addToCart;

  // --- REMOVE LOGIC ---
  const removeFromCart = (cartItemId: string) => {
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    // We expect ID to be a string like "1-30" (id-packSize) or "1-10 шт" (id-variantSize)
    // If the old code sends just a number (e.g. 1), we try to filter by ID loosely
    setItems((prev) => prev.filter((item) => {
        // Use variantSize if available, otherwise use packSize
        const sizeKey = item.variantSize || item.packSize;
        const compositeId = `${item.id}-${sizeKey}`;
        // If the input matches the composite ID, remove it
        if (compositeId === cartItemId) return false;
        // If the input matches just the numeric ID (legacy support), remove it
        if (String(item.id) === String(cartItemId)) return false;
        
        return true;
    }));
  };

  // Alias for backward compatibility
  const removeItem = removeFromCart;

  // --- QUANTITY MANAGEMENT (Match by id AND unit/variantSize) ---
  const addOne = (id: number, unit: string) => {
    console.log("🛒 Вызвана функция addOne, запускаю пуш...");
    InteractionManager.runAfterInteractions(() => scheduleCartNotification());
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) => {
      const newItems = prev.map((item) => {
        if (item.id === id) {
          if (item.variantSize && item.variantSize === unit) {
            return { ...item, quantity: item.quantity + 1 };
          }
          const itemUnit = item.unit || item.packSize || "шт";
          if (itemUnit === unit || item.packSize === unit) {
            return { ...item, quantity: item.quantity + 1 };
          }
        }
        return item;
      });
      itemsRef.current = newItems;
      return newItems;
    });
  };

  const removeOne = (id: number, unit: string) => {
    console.log("🛒 Вызвана функция removeOne, запускаю пуш...");
    InteractionManager.runAfterInteractions(() => scheduleCartNotification());
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) => {
      const result = prev.map((item) => {
        if (item.id === id) {
          let shouldUpdate = false;
          if (item.variantSize && item.variantSize === unit) {
            shouldUpdate = true;
          } else {
            const itemUnit = item.unit || item.packSize || "шт";
            if (itemUnit === unit || item.packSize === unit) {
              shouldUpdate = true;
            }
          }
          if (shouldUpdate) {
            const newQuantity = item.quantity - 1;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
        }
        return item;
      });
      const newItems = result.filter((item): item is CartItem => item !== null);
      itemsRef.current = newItems;
      return newItems;
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) => {
      const result = prev.map((item) => {
        const compositeId = item.variantSize
          ? `${item.id}-${item.variantSize}`
          : `${item.id}-${item.packSize}`;
        if (compositeId === cartItemId) {
          const newQuantity = Math.max(0, quantity);
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      const newItems = result.filter((item): item is CartItem => item !== null);
      itemsRef.current = newItems;
      return newItems;
    });
    InteractionManager.runAfterInteractions(() => scheduleCartNotification());
  };

  const clearCart = () => {
    cancelCartNotification();
    setItems([]);
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
  };

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const setPromoDiscount = (discountPercent: number, discountAmt: number, promoCode: string) => {
    setDiscount(discountPercent);
    setDiscountAmount(discountAmt);
    setAppliedPromoCode(promoCode);
  };
  
  const clearPromoDiscount = () => {
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
  };
  
  // Calculate final price with discount using useMemo for reactivity
  const finalPrice = useMemo(() => {
    const calculated = discount > 0 
      ? totalPrice * (1 - discount) 
      : Math.max(0, totalPrice - discountAmount);
    return calculated;
  }, [totalPrice, discount, discountAmount]);

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, addItem, 
      removeFromCart, removeItem, 
      addOne, removeOne,
      updateQuantity, clearCart, totalPrice,
      cancelCartNotification,
      discount, discountAmount, appliedPromoCode,
      setPromoDiscount, clearPromoDiscount, finalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
