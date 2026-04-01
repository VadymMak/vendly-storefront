import Link from 'next/link';
import Image from 'next/image';
import type { ShopItem, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import { CURRENCY_SYMBOLS } from '@/lib/constants';

interface RestaurantMenuProps {
  items: ShopItem[];
  categories: string[];
  scheme: ColorSchemeTokens;
  currency: string;
  t: ShopFrontMessages;
  activeCategory?: string | null;
  searchQuery?: string | null;
}

/**
 * Groups items by category preserving the order from `categories`.
 * Uncategorized items are appended at the end.
 */
function groupItems(
  items: ShopItem[],
  categories: string[],
): Array<{ category: string; items: ShopItem[] }> {
  const result: Array<{ category: string; items: ShopItem[] }> = [];
  const seen = new Set<string>();

  for (const cat of categories) {
    const catItems = items.filter((it) => it.category === cat);
    if (catItems.length > 0) {
      result.push({ category: cat, items: catItems });
      seen.add(cat);
    }
  }

  // Items with no category or unknown category
  const rest = items.filter((it) => !it.category || !seen.has(it.category));
  if (rest.length > 0) {
    result.push({ category: '', items: rest });
  }

  return result;
}

function MenuItemRow({
  item,
  currency,
  t,
  scheme,
}: {
  item: ShopItem;
  currency: string;
  t: ShopFrontMessages;
  scheme: ColorSchemeTokens;
}) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const hasImage = item.images.length > 0;

  return (
    <Link
      href={`/item/${item.id}`}
      className={`group flex items-start gap-4 rounded-2xl border px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:gap-5 sm:px-5 ${scheme.border} bg-white/70`}
    >
      {/* Thumbnail */}
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-20">
        {hasImage ? (
          <Image
            src={item.images[0]}
            alt={item.name}
            fill
            className={`object-cover transition-transform duration-500 group-hover:scale-105 ${!item.isAvailable ? 'opacity-50' : ''}`}
            sizes="80px"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${scheme.bgCard}`}>
            <svg
              width="24" height="24"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="opacity-25"
            >
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className={`text-[15px] font-semibold leading-snug ${scheme.text} group-hover:text-warm-accent transition-colors duration-200`}>
          {item.name}
        </h3>

        {item.description && (
          <p className={`text-[13px] leading-relaxed ${scheme.textMuted} line-clamp-2`}>
            {item.description}
          </p>
        )}

        {/* Metadata extras (allergens, weight, etc.) */}
        {item.metadata && (
          <div className={`mt-1 flex flex-wrap gap-2 text-[11px] font-medium ${scheme.textMuted}`}>
            {(item.metadata.weight as string) && (
              <span className={`rounded-full border px-2 py-0.5 ${scheme.border}`}>
                {item.metadata.weight as string}
              </span>
            )}
            {(item.metadata.allergens as string) && (
              <span className={`rounded-full border px-2 py-0.5 ${scheme.border}`}>
                {item.metadata.allergens as string}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Price + availability */}
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        {item.isAvailable ? (
          item.price !== null ? (
            <div className="flex items-baseline gap-0.5">
              <span className={`text-[18px] font-extrabold leading-none ${scheme.text}`} style={{ letterSpacing: '-0.02em' }}>
                {item.price.toFixed(2)}
              </span>
              <span className={`text-[13px] font-medium ${scheme.textMuted}`}>{currencySymbol}</span>
            </div>
          ) : (
            <span className={`text-[13px] font-medium ${scheme.textMuted}`}>{t.onRequest}</span>
          )
        ) : (
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${scheme.border} ${scheme.textMuted}`}>
            {t.unavailable}
          </span>
        )}

        {/* Arrow hint */}
        <svg
          width="14" height="14"
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`opacity-0 transition-opacity duration-200 group-hover:opacity-40 ${scheme.textMuted}`}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
}

export default function RestaurantMenu({
  items,
  categories,
  scheme,
  currency,
  t,
  activeCategory,
  searchQuery,
}: RestaurantMenuProps) {
  const showSections = !activeCategory && !searchQuery;

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${scheme.bgCard}`}>
          <svg
            width="32" height="32"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="opacity-40"
          >
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
          </svg>
        </div>
        <p className={`text-lg font-medium ${scheme.textMuted}`}>
          {searchQuery ? t.searchNoResults : t.emptyCategory}
        </p>
        {searchQuery && (
          <p className={`mt-1 text-sm ${scheme.textMuted} opacity-70`}>
            {t.searchNoResultsDesc}
          </p>
        )}
      </div>
    );
  }

  // ── Grouped by category (no filter active) ──
  if (showSections) {
    const groups = groupItems(items, categories);

    return (
      <div className="space-y-10">
        {groups.map(({ category, items: groupItems }) => (
          <div key={category || '__uncategorized'}>
            {/* Section heading */}
            {category && (
              <div className="mb-4 flex items-center gap-3">
                <h2
                  className={`text-[22px] font-extrabold tracking-tight ${scheme.text}`}
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {category}
                </h2>
                <div className={`h-px flex-1 ${scheme.border} border-t`} />
                <span className={`text-[13px] font-medium ${scheme.textMuted}`}>
                  {groupItems.length}
                </span>
              </div>
            )}

            {/* Item rows */}
            <div className="space-y-2">
              {groupItems.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  t={t}
                  scheme={scheme}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Flat list (category filter or search active) ──
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <MenuItemRow
          key={item.id}
          item={item}
          currency={currency}
          t={t}
          scheme={scheme}
        />
      ))}
    </div>
  );
}
