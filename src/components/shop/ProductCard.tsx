'use client';

import Link from 'next/link';
import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { useCart } from './CartContext';

interface ProductCardProps {
  item: ShopItem;
  scheme: ColorSchemeTokens;
  currency: string;
  slug: string;
}

export default function ProductCard({ item, scheme, currency, slug }: ProductCardProps) {
  const { addItem } = useCart();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const hasImage = item.images.length > 0;

  return (
    <div className={`group overflow-hidden rounded-xl ${scheme.bgCard} ${scheme.border} border transition-shadow hover:shadow-lg`}>
      {/* Image */}
      <Link href={`/shop/${slug}/item/${item.id}`}>
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {hasImage ? (
            <img
              src={item.images[0]}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-900">
                Nedostupné
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <Link href={`/shop/${slug}/item/${item.id}`}>
          <h3 className="font-semibold leading-tight hover:underline">{item.name}</h3>
        </Link>

        {item.category && (
          <p className={`mt-1 text-xs ${scheme.textMuted}`}>{item.category}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          {item.price !== null ? (
            <span className="text-lg font-bold">
              {item.price.toFixed(2)} {currencySymbol}
            </span>
          ) : (
            <span className={`text-sm ${scheme.textMuted}`}>Na dopyt</span>
          )}

          {item.isAvailable && item.price !== null && (
            <button
              onClick={() => addItem(item)}
              className={`rounded-lg ${scheme.accent} ${scheme.accentHover} px-3 py-2 text-sm font-medium transition-colors`}
              aria-label={`Pridať ${item.name} do košíka`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
