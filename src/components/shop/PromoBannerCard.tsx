import Image from 'next/image';
import type { PromoBanner, ColorSchemeTokens } from '@/lib/types';

interface PromoBannerCardProps {
  banner: PromoBanner;
  scheme: ColorSchemeTokens;
}

export default function PromoBannerCard({ banner, scheme }: PromoBannerCardProps) {
  const Wrapper = banner.ctaLink ? 'a' : 'div';
  const linkProps = banner.ctaLink
    ? { href: banner.ctaLink, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...linkProps}
      className={`col-span-full flex items-center gap-6 overflow-hidden rounded-2xl p-6 sm:p-8 transition-all ${scheme.heroBg} ${scheme.border} border hover:shadow-lg`}
    >
      {/* Image / Icon */}
      {banner.image ? (
        <div className="relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:block">
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className={`hidden h-24 w-24 shrink-0 items-center justify-center rounded-xl sm:flex ${scheme.accent} text-3xl`}>
          🎯
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-widest ${scheme.textMuted}`}>
          ★ Promo
        </p>
        <h3 className="mt-1 text-lg font-bold leading-snug sm:text-xl">{banner.title}</h3>
        <p className={`mt-1 text-sm leading-relaxed ${scheme.textMuted} line-clamp-2`}>
          {banner.description}
        </p>
      </div>

      {/* CTA */}
      {banner.ctaText && (
        <div className="hidden shrink-0 sm:block">
          <span className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${scheme.accent} ${scheme.accentHover}`}>
            {banner.ctaText}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>
      )}
    </Wrapper>
  );
}
