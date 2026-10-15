'use client';

import { useTranslations } from 'next-intl';
import { BRAND_KIT_DEFAULTS, FONT_PRESETS, INSTAGRAM_SAFE_ZONES } from '@/lib/constants';
import type { BrandKitData } from '@/lib/types';

interface BrandKitPreviewProps {
  brandKit: Partial<BrandKitData>;
  /** sm = mobile settings, md = desktop settings, lg = onboarding */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'max-w-[160px]',
  md: 'max-w-[280px]',
  lg: 'max-w-[360px]',
} as const;

// Same margins applyBrandWatermark uses on a 9:16 frame, as % of the 1080×1920 reference
const ZONE = {
  top:    `${(INSTAGRAM_SAFE_ZONES.top / 1920) * 100}%`,
  bottom: `${(INSTAGRAM_SAFE_ZONES.bottom / 1920) * 100}%`,
  sides:  `${(INSTAGRAM_SAFE_ZONES.sides / 1080) * 100}%`,
};

/** Live mock of a branded 9:16 post — plain HTML/CSS, mirrors the form without any API call. */
export function BrandKitPreview({ brandKit, size = 'md' }: BrandKitPreviewProps) {
  const t = useTranslations('settings.brandKit');
  const kit = { ...BRAND_KIT_DEFAULTS, ...brandKit };
  const font = FONT_PRESETS.find(p => p.id === kit.fontPreset) ?? FONT_PRESETS[0];
  const position = kit.watermarkPosition;
  const textShadow = '0 1px 3px rgba(0,0,0,0.45)';
  // The mobile preview is ~160px wide — scale the type down with it
  const nameSize = size === 'sm' ? 'text-[11px]' : 'text-base';
  const ctaSize  = size === 'sm' ? 'text-[9px] px-2 py-1' : 'text-xs px-3 py-1.5';

  return (
    <div
      className={`relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 shadow-xl ${SIZE_CLASS[size]} ${kit.enabled ? '' : 'opacity-40 grayscale'}`}
      style={{ background: `linear-gradient(160deg, ${kit.colorSecondary} 0%, ${kit.colorPrimary} 100%)` }}
      aria-label={t('preview')}
    >
      {/* Business name */}
      <p
        className={`absolute inset-x-0 px-3 text-center leading-tight ${nameSize}`}
        style={{ top: ZONE.top, color: kit.colorText, fontFamily: font.cssStack, fontWeight: font.weight, textShadow }}
      >
        {kit.businessName || t('sampleName')}
      </p>

      {/* CTA + handle, just above the bottom UI zone */}
      <div className="absolute inset-x-0 flex flex-col items-center gap-1 px-3" style={{ bottom: `calc(${ZONE.bottom} + 9%)` }}>
        <span
          className={`max-w-full truncate rounded-full font-semibold ${ctaSize}`}
          style={{ backgroundColor: kit.colorPrimary, color: kit.colorText, fontFamily: font.cssStack }}
        >
          {kit.ctaText || t('sampleCta')}
        </span>
        {kit.instagramHandle && (
          <span className="max-w-full truncate text-[9px]" style={{ color: kit.colorText, textShadow }}>
            @{kit.instagramHandle.replace(/^@/, '')}
          </span>
        )}
      </div>

      {/* Watermark logo */}
      {kit.watermarkEnabled && kit.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={kit.logoUrl}
          alt=""
          className="absolute h-auto object-contain"
          style={{
            width: `${kit.watermarkScale * 100}%`,
            opacity: kit.watermarkOpacity,
            ...(position.startsWith('top') ? { top: ZONE.top } : { bottom: ZONE.bottom }),
            ...(position.endsWith('right') ? { right: ZONE.sides } : { left: ZONE.sides }),
          }}
        />
      )}
    </div>
  );
}
