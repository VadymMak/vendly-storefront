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
  const hasSecondImage = item.images.length > 1;

  // Extract weight/volume from metadata if available
  const weight = (item.metadata?.weight as string) || null;

  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl ${scheme.bgCard} ${scheme.border} border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>

      {/* Image */}
      <Link href={`/item/${item.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {hasImage ? (
            <>
              <Image
                src={item.images[0]}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover transition-transform duration-500 ${hasSecondImage ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-105'}`}
                priority={priority}
              />
              {hasSecondImage && (
                <Image
                  src={item.images[1]}
                  alt={`${item.name} - 2`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${scheme.chipBg}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </div>
              <span className="text-[10px] font-medium opacity-30">{t.noPhoto}</span>
            </div>
          )}

          {/* Unavailable overlay */}
          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-gray-700 shadow">
                {t.unavailable}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5">
        {/* Category — small uppercase */}
        {item.category && (
          <span className={`text-[11px] font-medium uppercase tracking-wide ${scheme.textMuted}`}>
            {item.category}
          </span>
        )}

        {/* Name */}
        <Link href={`/item/${item.id}`}>
          <h3 className="mt-1 text-sm font-semibold leading-snug line-clamp-2 hover:underline">{item.name}</h3>
        </Link>

        {/* Weight / volume from metadata */}
        {weight && (
          <span className={`mt-0.5 text-xs ${scheme.textMuted}`}>{weight}</span>
        )}

        {/* Description (only if no weight, to save space) */}
        {!weight && item.description && (
          <p className={`mt-0.5 text-xs leading-relaxed line-clamp-1 ${scheme.textMuted}`}>
            {item.description}
          </p>
        )}

        {/* Price + cart button */}
        <div className="mt-auto flex items-center justify-between pt-3">
          {item.price !== null ? (
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-extrabold ${item.isAvailable ? '' : scheme.textMuted}`}>
                {item.price.toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${scheme.textMuted}`}>{currencySymbol}</span>
            </div>
          ) : (
            <span className={`text-sm ${scheme.textMuted}`}>{t.onRequest}</span>
          )}

          {item.isAvailable && item.price !== null && (
            <button
              onClick={() => addItem(item)}
              className={`flex h-9 w-9 items-center justify-center rounded-full ${scheme.accent} ${scheme.accentHover} shadow-md transition-all duration-200 active:scale-90`}
              aria-label={`${t.addToCartAriaPrefix} ${item.name}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
