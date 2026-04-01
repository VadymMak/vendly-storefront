'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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

  const rest = items.filter((it) => !it.category || !seen.has(it.category));
  if (rest.length > 0) {
    result.push({ category: '', items: rest });
  }

  return result;
}

/** Elegant list row: name ··· dotted line ··· price */
function ElegantMenuItem({
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
  const isUnavailable = !item.isAvailable;

  return (
    <Link
      href={`/item/${item.id}`}
      className={`group block border-b py-4 transition-all duration-200 hover:pl-2 ${scheme.border} border-opacity-30 last:border-b-0 ${isUnavailable ? 'opacity-60' : ''}`}
    >
      {/* Top row: name ··· price */}
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[16px] font-semibold ${scheme.text} ${isUnavailable ? 'line-through' : ''}`}
          style={{ letterSpacing: '-0.01em' }}
        >
          {item.name}
        </span>
        <span
          className="min-w-[40px] flex-1"
          style={{ borderBottom: '1px dotted var(--color-warm-border, #e8e0d6)', marginBottom: '4px' }}
        />
        {item.isAvailable ? (
          item.price !== null ? (
            <span
              className={`whitespace-nowrap text-[17px] font-bold text-warm-accent ${isUnavailable ? 'text-warm-muted' : ''}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              {item.price.toFixed(2)} {currencySymbol}
            </span>
          ) : (
            <span className={`text-[13px] font-medium ${scheme.textMuted}`}>{t.onRequest}</span>
          )
        ) : (
          <span className={`text-[13px] font-medium ${scheme.textMuted}`}>
            {t.unavailable}
          </span>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <p className={`mt-1 max-w-[500px] text-[13px] leading-relaxed ${scheme.textMuted}`}>
          {item.description}
        </p>
      )}

      {/* Metadata tags (weight, allergens) */}
      {item.metadata && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(item.metadata.weight as string) && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${scheme.border} ${scheme.textMuted}`}>
              {item.metadata.weight as string}
            </span>
          )}
          {(item.metadata.allergens as string) && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${scheme.border} ${scheme.textMuted}`}>
              {item.metadata.allergens as string}
            </span>
          )}
        </div>
      )}
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
  const groups = showSections ? groupItems(items, categories) : [];
  const visibleCategories = groups.map((g) => g.category).filter(Boolean);

  // ── Sticky tabs state ──
  const [activeTab, setActiveTab] = useState(visibleCategories[0] || '');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const isScrollingTo = useRef(false);

  // Observe which section is in view
  useEffect(() => {
    if (visibleCategories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingTo.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = entry.target.getAttribute('data-category');
            if (cat) setActiveTab(cat);
          }
        }
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: 0 },
    );

    for (const cat of visibleCategories) {
      const el = sectionRefs.current[cat];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCategories.length]);

  const scrollToCategory = useCallback((cat: string) => {
    setActiveTab(cat);
    const el = sectionRefs.current[cat];
    if (!el) return;
    isScrollingTo.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { isScrollingTo.current = false; }, 800);
  }, []);

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

  // ── Flat list (category filter or search active) ──
  if (!showSections) {
    return (
      <div className="mx-auto max-w-3xl">
        {items.map((item) => (
          <ElegantMenuItem key={item.id} item={item} currency={currency} t={t} scheme={scheme} />
        ))}
      </div>
    );
  }

  // ── Grouped elegant menu with sticky category tabs ──
  return (
    <>
      {/* Sticky category tabs */}
      {visibleCategories.length > 1 && (
        <div
          ref={tabsRef}
          className={`sticky top-[64px] z-[90] border-b bg-white ${scheme.border}`}
        >
          <div className="scrollbar-hide mx-auto flex max-w-[1200px] gap-0 overflow-x-auto px-6 sm:px-10">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`whitespace-nowrap border-b-2 px-6 py-4 text-[14px] font-semibold transition-all duration-200 ${
                  activeTab === cat
                    ? 'border-warm-accent text-warm-accent'
                    : `border-transparent ${scheme.textMuted} hover:text-warm-text`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu sections — narrower, elegant */}
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 sm:px-10">
        {groups.map(({ category, items: groupItems }) => (
          <div
            key={category || '__uncategorized'}
            ref={(el) => { if (category) sectionRefs.current[category] = el; }}
            data-category={category}
            className="mb-12 scroll-mt-32"
          >
            {/* Category header: title ——— count */}
            {category && (
              <div className="mb-6 flex items-center gap-4">
                <h2
                  className={`whitespace-nowrap text-[28px] font-bold ${scheme.headingFont || ''}`}
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

            {/* Elegant list items */}
            {groupItems.map((item) => (
              <ElegantMenuItem
                key={item.id}
                item={item}
                currency={currency}
                t={t}
                scheme={scheme}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
