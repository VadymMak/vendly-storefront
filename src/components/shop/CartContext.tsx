'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ShopItem, CartItem } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: ShopItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  currency: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

interface CartProviderProps {
  children: React.ReactNode;
  currency: string;
}

export function CartProvider({ children, currency }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((item: ShopItem) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
      return;
    }
    setItems((prev) =>
      prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity } : ci,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, ci) => sum + ci.quantity, 0);
  const totalPrice = items.reduce(
    (sum, ci) => sum + (ci.item.price || 0) * ci.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        currency,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
