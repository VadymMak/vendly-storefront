'use client';

import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import { useCart } from './CartContext';

interface AddToCartButtonProps {
  item: ShopItem;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function AddToCartButton({ item, scheme, t }: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => addItem(item)}
      className={`w-full rounded-lg ${scheme.accent} ${scheme.accentHover} px-6 py-3 font-semibold transition-colors`}
    >
      {t.addToCart}
    </button>
  );
}
