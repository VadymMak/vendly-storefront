import Image from 'next/image';
import type { ShopData, ColorSchemeTokens, HeroTextColor } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import StoreStatus from './StoreStatus';

interface ShopHeroProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

/**
 * Determines effective text color class based on heroTextColor setting.
 * 'auto': light text when banner image present, dark text for gradient-only.
 * 'light' / 'dark': explicit override by shop owner.
 */
function getHeroTextClasses(
  heroTextColor: HeroTextColor | undefined,
  hasBanner: boolean,
): { heading: string; description: string; overlay: string } {
  const mode = heroTextColor ?? 'auto';
  const isLight = mode === 'light' || (mode === 'auto' && hasBanner);

  if (isLight) {
    return {
      heading: 'text-white',
      description: 'text-white/85',
      overlay: hasBanner
        ? 'bg-gradient-to-t from-black/60 via-black/20 to-transparent'
        : 'bg-gradient-to-t from-black/40 via-black/10 to-transparent',
    };
  }

  return {
    heading: 'text-gray-900',
    description: 'text-gray-600',
    overlay: '',
  };
}

export default function ShopHero({ store, scheme, t }: ShopHeroProps) {
  const s = store.settings;
  const hasBanner = Boolean(s.bannerImage);
  const txt = getHeroTextClasses(s.heroTextColor, hasBanner);

  return (
    <section className="relative h-[420px] overflow-hidden sm:h-[520px]">
      {/* Background: banner image or gradient */}
      {hasBanner ? (
        <Image
          src={s.bannerImage!}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className={`absolute inset-0 ${scheme.heroBg}`} />
      )}

      {/* Gradient overlay */}
      {txt.overlay && <div className={`absolute inset-0 ${txt.overlay}`} />}

      {/* Content at bottom-left */}
      <div className="absolute inset-x-0 bottom-0 px-6 pb-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          {/* Status badge */}
          {s.structuredHours && (
            <div className="mb-4">
              <StoreStatus
                hours={s.structuredHours}
                orderAcceptance={s.orderAcceptance}
                scheme={scheme}
                shopLanguage={store.shopLanguage}
                hasBanner={hasBanner}
              />
            </div>
          )}

          {/* Store name */}
          <h1
            className={`text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl ${txt.heading}`}
            style={{ lineHeight: 1.1 }}
          >
            {store.name}
          </h1>

          {/* Description */}
          {store.description && (
            <p className={`mt-3 max-w-xl text-base leading-relaxed sm:text-lg ${txt.description}`}>
              {store.description}
            </p>
          )}

          {/* Quick badges — 3 mini trust badges */}
          {s.quickBadges && s.quickBadges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.quickBadges.slice(0, 3).map((badgeId) => (
                <span
                  key={badgeId}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm ${
                    txt.heading === 'text-white'
                      ? 'bg-white/15 text-white/90'
                      : `${scheme.chipBg} ${scheme.chipText}`
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badgeId.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* CTA button */}
          <a
            href="#products"
            className={`mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl ${
              txt.heading === 'text-white'
                ? 'bg-white text-gray-900'
                : `${scheme.accent} ${scheme.accentHover}`
            }`}
          >
            {t.navProducts}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
