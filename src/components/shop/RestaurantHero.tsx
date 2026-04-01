'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import type { ShopData, ColorSchemeTokens, ShopItem } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';

interface RestaurantHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
  items: ShopItem[];
  categories: string[];
}

/** Group items by category, returning only those with images. */
function groupByCategory(
  items: ShopItem[],
  categories: string[],
  allLabel: string,
): Record<string, ShopItem[]> {
  const map: Record<string, ShopItem[]> = {};
  for (const cat of categories) {
    const catItems = items.filter((it) => it.category === cat && it.images.length > 0);
    if (catItems.length > 0) map[cat] = catItems;
  }
  const uncategorized = items.filter((it) => !it.category && it.images.length > 0);
  if (uncategorized.length > 0 && Object.keys(map).length === 0) {
    map[allLabel] = uncategorized;
  }
  return map;
}

export default function RestaurantHero({ store, scheme, t, items, categories }: RestaurantHeroProps) {
  const s = store.settings;
  const hf = scheme.headingFont || '';

  const grouped = useMemo(
    () => groupByCategory(items, categories, t.allCategories),
    [items, categories, t.allCategories],
  );
  const catNames = useMemo(() => Object.keys(grouped), [grouped]);
  const hasShowcase = catNames.length > 0;

  const catNamesRef = useRef(catNames);
  catNamesRef.current = catNames;

  const [activeCat, setActiveCat] = useState(catNames[0] || '');
  const [animKey, setAnimKey] = useState(0);

  const switchCategory = useCallback((cat: string) => {
    setActiveCat(cat);
    setAnimKey((k) => k + 1);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catNames.length]);

  const showcaseItems = (grouped[activeCat] || []).slice(0, 3);

  // Reserve CTA: WhatsApp preferred, fallback to phone, fallback to #contact
  const reserveHref = s.whatsapp
    ? `https://wa.me/${s.whatsapp}`
    : s.phone
    ? `tel:${s.phone}`
    : '#contact';
  const reserveTarget = s.whatsapp ? '_blank' : undefined;

  return (
    <section
      className="relative min-h-[520px] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2c1810 0%, #4a2d1a 40%, #3d2c1e 100%)' }}
    >
      {/* Radial glow overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(212,100,26,0.15) 0%, transparent 70%),' +
            'radial-gradient(ellipse 50% 80% at 20% 80%, rgba(139,115,85,0.2) 0%, transparent 60%)',
        }}
      />
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-[500px] w-[500px] rounded-full border border-white/[0.06]" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full border border-white/[0.04]" />

      {/* Optional banner image as atmospheric overlay */}
      {s.bannerImage && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={s.bannerImage}
            alt={store.name}
            fill
            className="object-cover opacity-[0.18]"
            priority
          />
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 mx-auto grid min-h-[520px] max-w-7xl items-center gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-12">

        {/* ── LEFT: text + CTAs ── */}
        <div>
          {/* Open/closed status */}
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

          {/* Restaurant name */}
          <h1
            className={`text-[32px] font-extrabold text-white sm:text-[42px] lg:text-[54px] ${hf}`}
            style={{ lineHeight: 1.08, letterSpacing: '-0.02em' }}
          >
            <span className="text-warm-accent">{store.name}</span>
          </h1>

          {/* Tagline / description */}
          {store.description && (
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-[16px] sm:leading-[1.7]">
              {store.description.length > 130
                ? store.description.slice(0, store.description.lastIndexOf(' ', 130)) + '…'
                : store.description}
            </p>
          )}

          {/* Quick trust badges */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {s.quickBadges.slice(0, 4).map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white/75"
                >
                  <svg
                    width="13" height="13"
                    viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="opacity-70"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {/* Primary — view the menu */}
            <a
              href="#menu"
              className="inline-flex items-center gap-3 rounded-[14px] bg-warm-accent px-8 py-4 text-[16px] font-bold text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--color-warm-accent)_40%,transparent)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-warm-accent-hover hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--color-warm-accent)_50%,transparent)]"
            >
              {/* Fork & knife icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
              </svg>
              {t.browseProducts}
            </a>

            {/* Secondary — reserve a table */}
            {(s.whatsapp || s.phone) && (
              <a
                href={reserveHref}
                target={reserveTarget}
                rel={reserveTarget ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-3 rounded-[14px] border border-white/20 bg-white/[0.08] px-8 py-4 text-[16px] font-semibold text-white/90 backdrop-blur-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.14]"
              >
                {/* Calendar icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Rezervovať stôl
              </a>
            )}
          </div>
        </div>

        {/* ── RIGHT: menu category showcase ── */}
        {hasShowcase && (
          <div className="hidden lg:block">
            {/* Category pills */}
            <div className="mb-5 flex flex-wrap gap-2">
              {catNames.map((cat) => (
                <button
                  key={cat}
                  onClick={() => switchCategory(cat)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-300 ${
                    activeCat === cat
                      ? 'border border-warm-accent bg-warm-accent text-white'
                      : 'border border-white/12 bg-white/[0.08] text-white/65 hover:bg-white/[0.14] hover:text-white/90'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu items grid — first card spans 2 rows */}
            <div key={animKey} className="hero-fade-slide grid grid-cols-2 gap-3.5">
              {showcaseItems.map((item, i) => (
                <a
                  key={item.id}
                  href="#menu"
                  className={`group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.12] ${
                    i === 0 ? 'row-span-2' : ''
                  }`}
                >
                  <div
                    className={`relative w-full overflow-hidden ${
                      i === 0 ? 'h-full min-h-[260px]' : 'aspect-square'
                    }`}
                  >
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes={i === 0 ? '280px' : '200px'}
                    />
                    {/* Bottom gradient for text legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3">
                      <p className="text-[13px] font-semibold leading-snug text-white/90">
                        {item.name}
                      </p>
                      {item.price != null && (
                        <p className="mt-0.5 text-[15px] font-bold text-warm-accent">
                          {item.price.toFixed(2)} {item.currency}
                        </p>
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
