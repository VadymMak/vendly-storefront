import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';

interface ShopHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

/**
 * Splits a description into a short headline (first sentence or ~60 chars)
 * and the rest as subtitle. Used when no heroTagline is set.
 */
function splitDescription(desc: string): { headline: string; subtitle: string } {
  // Try first sentence
  const sentenceEnd = desc.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd <= 80) {
    return {
      headline: desc.slice(0, sentenceEnd + 1).trim(),
      subtitle: desc.slice(sentenceEnd + 2).trim(),
    };
  }
  // Fallback: split at ~60 chars on word boundary
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

export default function ShopHero({ store, scheme, t }: ShopHeroProps) {
  const s = store.settings;
  const hf = scheme.headingFont || '';

  // Use description as hero tagline — split into headline + subtitle
  const hasDescription = !!store.description;
  const { headline, subtitle } = hasDescription
    ? splitDescription(store.description as string)
    : { headline: '', subtitle: '' };

  return (
    <section className={`relative min-h-[600px] overflow-hidden sm:min-h-[700px] ${scheme.heroBg}`}>
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
      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-7xl items-center px-6 py-20 sm:min-h-[700px] sm:px-10 sm:py-28 lg:px-12">
        <div className="max-w-3xl">
          {/* Status badge */}
          {s.structuredHours && (
            <div className="mb-8">
              <StoreStatus
                hours={s.structuredHours}
                orderAcceptance={s.orderAcceptance}
                scheme={scheme}
                shopLanguage={store.shopLanguage}
                hasBanner={false}
              />
            </div>
          )}

          {/* Main heading — big dramatic tagline like mockup */}
          {hasDescription ? (
            <>
              <h1
                className={`text-[48px] font-extrabold text-white sm:text-[64px] lg:text-[80px] ${hf}`}
                style={{ lineHeight: 1.05, letterSpacing: '-0.025em' }}
              >
                {headline}
              </h1>
              {subtitle && (
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60 sm:text-[19px] sm:leading-[1.75]">
                  {subtitle}
                </p>
              )}
            </>
          ) : (
            <h1
              className={`text-[48px] font-extrabold text-white sm:text-[64px] lg:text-[80px] ${hf}`}
              style={{ lineHeight: 1.05, letterSpacing: '-0.025em' }}
            >
              {store.name}
            </h1>
          )}

          {/* Quick badges — glass pills in hero */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {s.quickBadges.slice(0, 4).map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-5 py-2.5 text-[14px] font-medium text-white/75"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTA button — orange accent, larger like mockup */}
          <a
            href="#products"
            className="mt-10 inline-flex items-center gap-3 rounded-[16px] bg-warm-accent px-10 py-5 text-[17px] font-bold text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--color-warm-accent)_40%,transparent)] transition-all duration-250 hover:-translate-y-0.5 hover:bg-warm-accent-hover hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--color-warm-accent)_50%,transparent)]"
          >
            {t.browseProducts}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
