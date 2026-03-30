import Image from 'next/image';
import type { PromoBanner, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';

interface PromoBannerCardProps {
  banner: PromoBanner;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function PromoBannerCard({ banner, scheme, t }: PromoBannerCardProps) {
  const Wrapper = banner.ctaLink ? 'a' : 'div';
  const linkProps = banner.ctaLink
    ? { href: banner.ctaLink, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className="col-span-full group relative flex min-h-[180px] items-center gap-8 overflow-hidden rounded-2xl bg-gradient-to-br from-warm-dark via-warm-dark-mid to-warm-dark-deep p-8 shadow-lg transition-all duration-300 hover:shadow-xl sm:min-h-[200px] sm:p-10"
    >
      {/* Decorative radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 80% at 80% 50%, rgba(212,100,26,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Image / Icon */}
      {banner.image ? (
        <div className="relative z-10 hidden h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/10 sm:block lg:h-32 lg:w-32">
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            sizes="128px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="relative z-10 hidden h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-warm-accent/20 text-4xl shadow-lg ring-2 ring-white/10 sm:flex lg:h-32 lg:w-32">
          🎯
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-warm-accent">
          ★ {t.promo}
        </p>
        <h3 className={`mt-2 text-xl font-extrabold leading-snug text-white sm:text-2xl ${scheme.headingFont || ''}`}>
          {banner.title}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55 line-clamp-2 sm:text-[15px]">
          {banner.description}
        </p>
      </div>

      {/* CTA */}
      {banner.ctaText && (
        <div className="relative z-10 hidden shrink-0 sm:block">
          <span className="inline-flex items-center gap-2.5 rounded-xl bg-warm-accent px-6 py-3 text-sm font-bold text-white shadow-[0_4px_16px_color-mix(in_srgb,var(--color-warm-accent)_35%,transparent)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--color-warm-accent)_45%,transparent)]">
            {banner.ctaText}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </div>
      )}
    </Wrapper>
  );
}
