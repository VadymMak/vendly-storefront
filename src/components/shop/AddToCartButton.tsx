'use client';

import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import { useCart } from './CartContext';

interface AddToCartButtonProps {
  item: ShopItem;
  scheme: ColorSchemeTokens;
}

export default function AddToCartButton({ item, scheme }: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => addItem(item)}
      className={`w-full rounded-lg ${scheme.accent} ${scheme.accentHover} px-6 py-3 font-semibold transition-colors`}
    >
      Pridať do košíka
    </button>
  );
}
