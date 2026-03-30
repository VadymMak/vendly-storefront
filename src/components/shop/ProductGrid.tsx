'use client';

import type { ShopItem, ColorSchemeTokens, PromoBanner } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import ProductCard from './ProductCard';
import PromoBannerCard from './PromoBannerCard';

interface ProductGridProps {
  items: ShopItem[];
  scheme: ColorSchemeTokens;
  currency: string;
  t: ShopFrontMessages;
  promoBanners?: PromoBanner[];
}

/** Number of products per row before inserting a banner */
const ITEMS_PER_BANNER = 4;

export default function ProductGrid({ items, scheme, currency, t, promoBanners = [] }: ProductGridProps) {
  const enabledBanners = promoBanners.filter((b) => b.enabled);

  // If no banners — simple grid
  if (enabledBanners.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
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

  // With banners: split items into chunks of ITEMS_PER_BANNER, insert banners between
  const chunks: ShopItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_BANNER) {
    chunks.push(items.slice(i, i + ITEMS_PER_BANNER));
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {chunks.map((chunk, chunkIndex) => (
        <div key={`chunk-${chunkIndex}`} className="contents">
          {/* Product cards */}
          {chunk.map((item, itemIndex) => (
            <ProductCard
              key={item.id}
              item={item}
              scheme={scheme}
              currency={currency}
              t={t}
              priority={chunkIndex === 0 && itemIndex < 4}
            />
          ))}

          {/* Banner after this chunk (if available) */}
          {chunkIndex < chunks.length - 1 && chunkIndex < enabledBanners.length && (
            <PromoBannerCard
              key={`banner-${enabledBanners[chunkIndex].id}`}
              banner={enabledBanners[chunkIndex]}
              scheme={scheme}
            />
          )}
        </div>
      ))}
    </div>
  );
}
