'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface QuickAction {
  titleKey: string;
  subtitleKey: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
}

const PRIMARY_ACTION_DEFS: Omit<QuickAction, 'titleKey' | 'subtitleKey'>[] = [
  {
    href: '/studio/m/create',
    primary: true,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    href: '/studio/m/improve',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l1.8 5.55H19.5l-4.65 3.38 1.77 5.45L12 13.1l-4.62 3.28 1.77-5.45L4.5 7.55h5.7z" />
      </svg>
    ),
  },
  {
    href: '/studio/m/video',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="15" height="15" rx="2" />
        <path d="M17 7.5l5-3v13l-5-3" />
      </svg>
    ),
  },
  {
    href: '/studio/m/product-photo',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    href: '/studio/m/remove-bg',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: '/studio/m/upscale',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
];

const PRIMARY_TITLE_KEYS = ['instagramPost', 'improvePhoto', 'shortVideo', 'productPhoto', 'removeBg', 'upscale'] as const;
const PRIMARY_SUBTITLE_KEYS = ['instagramPostDesc', 'improvePhotoDesc', 'shortVideoDesc', 'productPhotoDesc', 'removeBgDesc', 'upscaleDesc'] as const;

const MORE_ACTION_DEFS: Omit<QuickAction, 'titleKey' | 'subtitleKey'>[] = [
  {
    href: '/studio/m/inpaint',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: '/studio/m/generate-video',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
  {
    href: '/studio/m/product-photo?scene=1',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
];

const MORE_TITLE_KEYS = ['editReplace', 'generateVideo', 'placeInScene'] as const;
const MORE_SUBTITLE_KEYS = ['editReplaceDesc', 'generateVideoDesc', 'placeInSceneDesc'] as const;

function ActionCard({ title, subtitle, href, icon, primary }: { title: string; subtitle: string; href: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex h-[120px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all active:scale-[0.97] hover:bg-white/[0.08] ${primary ? 'col-span-2' : ''}`}
    >
      <span className="text-green-500">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] text-gray-500 leading-tight">{subtitle}</p>
      </div>
    </Link>
  );
}

export function QuickActionGrid() {
  const t = useTranslations('mobile.tools');
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="space-y-4">
      {/* Primary 2×3 grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {PRIMARY_ACTION_DEFS.map((def, i) => (
          <ActionCard
            key={def.href}
            title={t(PRIMARY_TITLE_KEYS[i])}
            subtitle={t(PRIMARY_SUBTITLE_KEYS[i])}
            href={def.href}
            icon={def.icon}
            primary={def.primary}
          />
        ))}
      </div>

      {/* More tools */}
      <div className="px-4">
        <button
          onClick={() => setShowMore(v => !v)}
          className="flex w-full items-center justify-between py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          <span>{t('moreTools')}</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${showMore ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showMore && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {MORE_ACTION_DEFS.map((def, i) => (
              <ActionCard
                key={def.href}
                title={t(MORE_TITLE_KEYS[i])}
                subtitle={t(MORE_SUBTITLE_KEYS[i])}
                href={def.href}
                icon={def.icon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
