import Image from 'next/image';
import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';

interface RestaurantHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function RestaurantHero({ store, scheme, t }: RestaurantHeroProps) {
  const s = store.settings;
  const hf = scheme.headingFont || '';

  // Reserve CTA: WhatsApp preferred, fallback to phone, fallback to #contact
  const reserveHref = s.whatsapp
    ? `https://wa.me/${s.whatsapp}`
    : s.phone
    ? `tel:${s.phone}`
    : '#contact';
  const reserveTarget = s.whatsapp ? '_blank' : undefined;

  return (
    <section
      className="relative overflow-hidden"
      style={{
        height: '340px',
        background: 'linear-gradient(135deg, #2c1810 0%, #4a2d1a 40%, #3d2c1e 100%)',
      }}
    >
      {/* Banner image as atmospheric overlay */}
      {s.bannerImage && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={s.bannerImage}
            alt={store.name}
            fill
            className="object-cover opacity-30"
            priority
          />
        </div>
      )}

      {/* Dark gradient overlay — stronger at bottom for text legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(44,24,16,0.95) 0%, rgba(44,24,16,0.4) 100%)',
        }}
      />

      {/* Content — bottom-aligned */}
      <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-end px-6 pb-10 sm:px-10">
        {/* Status badge */}
        {s.structuredHours && (
          <div className="mb-4">
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
          className={`text-[36px] font-extrabold text-white sm:text-[42px] lg:text-[48px] ${hf}`}
          style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}
        >
          {store.name}
        </h1>

        {/* Tagline */}
        {store.description && (
          <p className="mt-2 max-w-[500px] text-[15px] leading-relaxed text-white/55">
            {store.description.length > 130
              ? store.description.slice(0, store.description.lastIndexOf(' ', 130)) + '…'
              : store.description}
          </p>
        )}

        {/* CTAs */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* View menu */}
          <a
            href="#menu"
            className="inline-flex items-center gap-2 rounded-xl bg-warm-accent px-7 py-3 text-[15px] font-bold text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--color-warm-accent)_35%,transparent)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-warm-accent-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
            </svg>
            {t.browseProducts}
          </a>

          {/* Reserve table */}
          {(s.whatsapp || s.phone) && (
            <a
              href={reserveHref}
              target={reserveTarget}
              rel={reserveTarget ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-7 py-3 text-[15px] font-semibold text-white/85 backdrop-blur-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.14]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    </section>
  );
}
