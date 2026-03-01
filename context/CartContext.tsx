import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import React, { createContext, useContext, useMemo, useState } from 'react';

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

  // --- ADD LOGIC ---
  const addToCart = (product: any, quantity: number, packSize: string, customUnit?: string, customPrice?: number) => {
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

        return [
          ...currentItems,
          newItem,
        ];
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
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) =>
      prev.map((item) => {
        // Match by BOTH id AND (variantSize OR unit OR packSize)
        if (item.id === id) {
          // Try matching by variantSize first
          if (item.variantSize && item.variantSize === unit) {
            return { ...item, quantity: item.quantity + 1 };
          }
          // Try matching by unit
          const itemUnit = item.unit || item.packSize || "шт";
          if (itemUnit === unit) {
            return { ...item, quantity: item.quantity + 1 };
          }
          // Try matching by packSize if unit doesn't match
          if (item.packSize === unit) {
            return { ...item, quantity: item.quantity + 1 };
          }
        }
        return item;
      })
    );
  };

  const removeOne = (id: number, unit: string) => {
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) => {
      const result = prev.map((item) => {
        // Match by BOTH id AND (variantSize OR unit OR packSize)
        if (item.id === id) {
          let shouldUpdate = false;
          
          // Try matching by variantSize first
          if (item.variantSize && item.variantSize === unit) {
            shouldUpdate = true;
          }
          // Try matching by unit
          else {
            const itemUnit = item.unit || item.packSize || "шт";
            if (itemUnit === unit || item.packSize === unit) {
              shouldUpdate = true;
            }
          }
          
          if (shouldUpdate) {
            const newQuantity = item.quantity - 1;
            if (newQuantity <= 0) {
              return null; // Mark for removal
            }
            return { ...item, quantity: newQuantity };
          }
        }
        return item;
      });
      // Filter out null items (removed)
      return result.filter((item): item is CartItem => item !== null);
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    setDiscount(0);
    setDiscountAmount(0);
    setAppliedPromoCode('');
    setItems((prev) => {
      const result = prev.map((item) => {
        // Match by composite ID: id-variantSize or id-packSize
        const compositeId = item.variantSize 
          ? `${item.id}-${item.variantSize}` 
          : `${item.id}-${item.packSize}`;
        if (compositeId === cartItemId) {
          const newQuantity = Math.max(0, quantity);
          if (newQuantity <= 0) {
            return null; // Mark for removal when quantity reaches 0
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      // Filter out null items (removed)
      return result.filter((item): item is CartItem => item !== null);
    });
  };

  const clearCart = () => {
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
      discount, discountAmount, appliedPromoCode,
      setPromoDiscount, clearPromoDiscount, finalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
