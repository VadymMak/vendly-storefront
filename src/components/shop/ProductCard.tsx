'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { useCart } from './CartContext';

interface ProductCardProps {
  item: ShopItem;
  scheme: ColorSchemeTokens;
  currency: string;
  t: ShopFrontMessages;
  priority?: boolean;
}

export default function ProductCard({ item, scheme, currency, t, priority = false }: ProductCardProps) {
  const { addItem } = useCart();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const hasImage = item.images.length > 0;

  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl ${scheme.bgCard} ${scheme.border} border transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5`}>

      {/* Image */}
      <Link href={`/item/${item.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {hasImage ? (
            <Image
              src={item.images[0]}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={priority}
            />
          ) : (
            <div className={`flex h-full w-full flex-col items-center justify-center gap-2 ${scheme.heroBg}`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="text-xs opacity-30">{t.noPhoto}</span>
            </div>
          )}

          {/* Unavailable overlay */}
          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 shadow">
                {t.unavailable}
              </span>
            </div>
          )}

          {/* Category badge */}
          {item.category && (
            <div className="absolute left-3 top-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${scheme.chipBg} ${scheme.chipText}`}>
                {item.category}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/item/${item.id}`}>
          <h3 className="font-semibold leading-snug hover:underline line-clamp-2">{item.name}</h3>
        </Link>

        {item.description && (
          <p className={`mt-1 text-sm leading-relaxed line-clamp-2 ${scheme.textMuted}`}>
            {item.description}
          </p>
        )}

        {/* Price + cart button */}
        <div className="mt-auto flex items-center justify-between pt-3">
          {item.price !== null ? (
            <span className="text-xl font-bold">
              {item.price.toFixed(2)}{' '}
              <span className="text-base font-normal opacity-70">{currencySymbol}</span>
            </span>
          ) : (
            <span className={`text-sm ${scheme.textMuted}`}>{t.onRequest}</span>
          )}

          {item.isAvailable && item.price !== null && (
            <button
              onClick={() => addItem(item)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${scheme.accent} ${scheme.accentHover} active:scale-95`}
              aria-label={`${t.addToCartAriaPrefix} ${item.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              <span className="hidden sm:inline">{t.addToCart}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
