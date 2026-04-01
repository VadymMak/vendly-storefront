import Image from 'next/image';
import Link from 'next/link';
import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import { CURRENCY_SYMBOLS } from '@/lib/constants';

interface FeaturedDishesProps {
  items: ShopItem[];
  currency: string;
  scheme: ColorSchemeTokens;
}

/**
 * Horizontal scroll strip of popular/featured dishes.
 * Rendered between the hero and the menu for restaurant templates.
 * Shows items that have images, up to 8 max.
 */
export default function FeaturedDishes({ items, currency, scheme }: FeaturedDishesProps) {
  const featured = items.filter((it) => it.images.length > 0 && it.isAvailable).slice(0, 8);

  if (featured.length === 0) return null;

  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

  return (
    <section className={`border-b bg-white ${scheme.border}`} style={{ padding: '32px 0' }}>
      <div className="mx-auto max-w-[1200px] px-6 sm:px-10">
        {/* Section label */}
        <p className={`mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] ${scheme.textMuted}`}>
          ⭐ Populárne jedlá
        </p>

        {/* Horizontal scroll */}
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1">
          {featured.map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              className={`group flex-shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${scheme.border}`}
              style={{ width: '220px' }}
            >
              {/* Image */}
              <div className="relative h-[160px] w-full overflow-hidden">
                <Image
                  src={item.images[0]}
                  alt={item.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="220px"
                />
              </div>

              {/* Info */}
              <div className="px-3.5 py-3">
                <p className={`text-[14px] font-semibold leading-snug ${scheme.text}`}>
                  {item.name}
                </p>
                {item.price != null && (
                  <p className="mt-1 text-[15px] font-bold text-warm-accent">
                    {item.price.toFixed(2)} {currencySymbol}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
