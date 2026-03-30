'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ShopData, ColorSchemeTokens, ShopItem } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';
import Image from 'next/image';

interface ShopHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
  items: ShopItem[];
  categories: string[];
}

/**
 * Splits a description into a short headline (first sentence or ~60 chars)
 * and the rest as subtitle. Used when no heroTagline is set.
 */
function splitDescription(desc: string): { headline: string; subtitle: string } {
  const sentenceEnd = desc.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd <= 80) {
    return {
      headline: desc.slice(0, sentenceEnd + 1).trim(),
      subtitle: desc.slice(sentenceEnd + 2).trim(),
    };
  }
  if (desc.length > 60) {
    const cut = desc.lastIndexOf(' ', 60);
    if (cut > 20) {
      return {
        headline: desc.slice(0, cut).trim(),
        subtitle: desc.slice(cut + 1).trim(),
      };
    }
  }
  return { headline: desc, subtitle: '' };
}

/**
 * Highlights the store name inside the headline with accent color.
 * If the store name appears at the start, it becomes accent-colored.
 * Otherwise, the first 2 words are white, rest is accent.
 */
function renderHighlightedHeadline(headline: string, storeName: string): React.ReactNode {
  // Try to find the store name at the beginning of the headline
  const lowerHeadline = headline.toLowerCase();
  const lowerName = storeName.toLowerCase();

  if (lowerHeadline.startsWith(lowerName)) {
    const nameEnd = storeName.length;
    return (
      <>
        <span className="text-warm-accent">{headline.slice(0, nameEnd)}</span>
        {headline.slice(nameEnd)}
      </>
    );
  }

  // Fallback: accent the first 2 words
  const words = headline.split(' ');
  if (words.length >= 3) {
    const accentPart = words.slice(0, 2).join(' ');
    const rest = words.slice(2).join(' ');
    return (
      <>
        <span className="text-warm-accent">{accentPart}</span>{' '}
        {rest}
      </>
    );
  }

  return headline;
}

/** Group items by category, returning a map. Null-category items go under allCategories label. */
function groupByCategory(
  items: ShopItem[],
  categories: string[],
  allLabel: string,
): Record<string, ShopItem[]> {
  const map: Record<string, ShopItem[]> = {};

  // Only use categories that have items
  for (const cat of categories) {
    const catItems = items.filter((it) => it.category === cat && it.images.length > 0);
    if (catItems.length > 0) {
      map[cat] = catItems;
    }
  }

  // If there are uncategorized items with images, group them
  const uncategorized = items.filter((it) => !it.category && it.images.length > 0);
  if (uncategorized.length > 0 && Object.keys(map).length === 0) {
    map[allLabel] = uncategorized;
  }

  return map;
}

export default function ShopHero({ store, scheme, t, items, categories }: ShopHeroProps) {
  const s = store.settings;
  const hf = scheme.headingFont || '';

  const hasDescription = !!store.description;
  const { headline, subtitle } = hasDescription
    ? splitDescription(store.description as string)
    : { headline: '', subtitle: '' };

  // Group items by category for the showcase — memoize to keep stable reference
  const grouped = useMemo(
    () => groupByCategory(items, categories, t.allCategories),
    [items, categories, t.allCategories],
  );
  const catNames = useMemo(() => Object.keys(grouped), [grouped]);
  const hasShowcase = catNames.length > 0;

  // Keep catNames in a ref so the interval callback always sees the latest
  const catNamesRef = useRef(catNames);
  catNamesRef.current = catNames;

  const [activeCat, setActiveCat] = useState(catNames[0] || '');
  const [animKey, setAnimKey] = useState(0);

  const switchCategory = useCallback(
    (cat: string) => {
      setActiveCat(cat);
      setAnimKey((k) => k + 1);
    },
    [],
  );

  // Auto-switch categories every 5 seconds
  useEffect(() => {
    if (catNames.length <= 1) return;
    const timer = setInterval(() => {
      const cats = catNamesRef.current;
      setActiveCat((prev) => {
        const idx = cats.indexOf(prev);
        const next = cats[(idx + 1) % cats.length];
        setAnimKey((k) => k + 1);
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
    // catNames.length triggers setup only when count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catNames.length]);

  // Get up to 3 items for the active category
  const showcaseItems = (grouped[activeCat] || []).slice(0, 3);

  return (
    <section className={`relative min-h-[480px] overflow-hidden ${scheme.heroBg}`}>
      {/* Decorative radial gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(212,100,26,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 80% at 20% 80%, rgba(139,115,85,0.2) 0%, transparent 60%)',
        }}
      />
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-[500px] w-[500px] rounded-full border border-white/[0.06]" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full border border-white/[0.04]" />

      {/* Content — grid: left text | right showcase */}
      <div className="relative z-10 mx-auto grid min-h-[480px] max-w-7xl items-center gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-12">
        {/* ── LEFT: compact text ── */}
        <div>
          {/* Status badge */}
          {s.structuredHours && (
            <div className="mb-6">
              <StoreStatus
                hours={s.structuredHours}
                orderAcceptance={s.orderAcceptance}
                scheme={scheme}
                shopLanguage={store.shopLanguage}
                hasBanner={false}
              />
            </div>
          )}

          {/* Heading — store name in accent, rest in white */}
          {hasDescription ? (
            <>
              <h1
                className={`text-[28px] font-extrabold text-white sm:text-[36px] lg:text-[44px] ${hf}`}
                style={{ lineHeight: 1.12, letterSpacing: '-0.02em' }}
              >
                {renderHighlightedHeadline(headline, store.name)}
              </h1>
              {subtitle && (
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-[16px] sm:leading-[1.7]">
                  {subtitle}
                </p>
              )}
            </>
          ) : (
            <h1
              className={`text-[28px] font-extrabold text-white sm:text-[36px] lg:text-[44px] ${hf}`}
              style={{ lineHeight: 1.12, letterSpacing: '-0.02em' }}
            >
              <span className="text-warm-accent">{store.name}</span>
            </h1>
          )}

          {/* Quick badges */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {s.quickBadges.slice(0, 4).map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white/75"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <a
            href="#products"
            className="mt-8 inline-flex items-center gap-3 rounded-[14px] bg-warm-accent px-8 py-4 text-[16px] font-bold text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--color-warm-accent)_40%,transparent)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-warm-accent-hover hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--color-warm-accent)_50%,transparent)]"
          >
            {t.browseProducts}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>

        {/* ── RIGHT: interactive category showcase ── */}
        {hasShowcase && (
          <div className="hidden lg:block">
            {/* Category pills */}
            <div className="mb-5 flex flex-wrap gap-2">
              {catNames.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    switchCategory(cat);
                  }}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-300 ${
                    activeCat === cat
                      ? 'bg-warm-accent border-warm-accent border text-white'
                      : 'border border-white/12 bg-white/[0.08] text-white/65 hover:bg-white/[0.14] hover:text-white/90'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product grid — 2 columns, first card spans 2 rows */}
            <div
              key={animKey}
              className="hero-fade-slide grid grid-cols-2 gap-3.5"
            >
              {showcaseItems.map((item, i) => (
                <a
                  key={item.id}
                  href={`#products`}
                  className={`group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.12] ${
                    i === 0 ? 'row-span-2' : ''
                  }`}
                >
                  {/* Image */}
                  <div className={`relative w-full overflow-hidden ${i === 0 ? 'h-full min-h-[260px]' : 'aspect-square'}`}>
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes={i === 0 ? '280px' : '200px'}
                    />
                    {/* Gradient overlay at bottom for text readability */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Info overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3">
                      <div className="text-[13px] font-semibold text-white/90 leading-snug">
                        {item.name}
                      </div>
                      {item.price != null && (
                        <div className="mt-0.5 text-[15px] font-bold text-warm-accent">
                          {item.price.toFixed(2)} {item.currency}
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
