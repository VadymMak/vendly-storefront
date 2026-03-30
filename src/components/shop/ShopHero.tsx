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
    <section className={`relative min-h-[480px] overflow-hidden ${scheme.heroBg}`}>
      {/* Decorative radial gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(212,100,26,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 80% at 20% 80%, rgba(139,115,85,0.2) 0%, transparent 60%)',
        }}
      />
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-[500px] w-[500px] rounded-full border border-white/[0.06]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[480px] max-w-7xl items-center px-6 py-20 sm:px-10 lg:px-12">
        <div className="max-w-xl">
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

          {/* Store name — large serif-like heading */}
          <h1
            className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[52px]"
            style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}
          >
            {store.name}
          </h1>

          {/* Description */}
          {store.description && (
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/65 sm:text-[17px]">
              {store.description}
            </p>
          )}

          {/* Quick badges — glass pills in hero */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {s.quickBadges.slice(0, 4).map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3.5 py-1.5 text-[13px] font-medium text-white/75"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTA button — orange accent */}
          <a
            href="#products"
            className="mt-8 inline-flex items-center gap-2.5 rounded-[14px] bg-[#d4641a] px-8 py-4 text-base font-bold text-white shadow-[0_4px_20px_rgba(212,100,26,0.4)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-[#b8550f] hover:shadow-[0_8px_30px_rgba(212,100,26,0.5)]"
          >
            {t.navProducts}
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
