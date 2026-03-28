'use client';

import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import ProductCard from './ProductCard';

interface ProductGridProps {
  items: ShopItem[];
  scheme: ColorSchemeTokens;
  currency: string;
  t: ShopFrontMessages;
}

export default function ProductGrid({ items, scheme, currency, t }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <ProductCard
          key={item.id}
          item={item}
          scheme={scheme}
          currency={currency}
          t={t}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
