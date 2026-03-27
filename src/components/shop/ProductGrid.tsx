'use client';

import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import ProductCard from './ProductCard';
import { usePathname } from 'next/navigation';

interface ProductGridProps {
  items: ShopItem[];
  scheme: ColorSchemeTokens;
  currency: string;
}

export default function ProductGrid({ items, scheme, currency }: ProductGridProps) {
  const pathname = usePathname();
  // Extract slug from /shop/[slug]
  const slug = pathname.split('/')[2] || '';

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          scheme={scheme}
          currency={currency}
          slug={slug}
        />
      ))}
    </div>
  );
}
