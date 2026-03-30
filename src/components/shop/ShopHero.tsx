import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';

interface ShopHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function ShopHero({ store, scheme, t }: ShopHeroProps) {
  const s = store.settings;

  return (
    <section className={`relative min-h-[560px] overflow-hidden sm:min-h-[640px] ${scheme.heroBg}`}>
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

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[560px] max-w-7xl items-center px-6 py-20 sm:min-h-[640px] sm:px-10 sm:py-24 lg:px-12">
        <div className="max-w-2xl">
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

          {/* Store name — large heading */}
          <h1
            className={`text-[40px] font-extrabold tracking-tight text-white sm:text-[52px] lg:text-[60px] ${scheme.headingFont || ''}`}
            style={{ lineHeight: 1.08, letterSpacing: '-0.02em' }}
          >
            {store.name}
          </h1>

          {/* Description */}
          {store.description && (
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/65 sm:text-[18px] sm:leading-[1.7]">
              {store.description}
            </p>
          )}

          {/* Quick badges — glass pills in hero */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-3">
              {s.quickBadges.slice(0, 4).map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white/75"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTA button — orange accent, larger */}
          <a
            href="#products"
            className="mt-9 inline-flex items-center gap-2.5 rounded-[14px] bg-warm-accent px-8 py-4 text-[16px] font-bold text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--color-warm-accent)_40%,transparent)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-warm-accent-hover hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--color-warm-accent)_50%,transparent)]"
          >
            {t.navProducts}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
