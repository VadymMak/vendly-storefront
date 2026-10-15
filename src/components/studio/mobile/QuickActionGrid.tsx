'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface QuickAction {
  titleKey: string;
  subtitleKey: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
}

// Only tools with a working mobile flow. Stub routes (/video, /product-photo, /inpaint,
// /generate-video) stay in the app but get no card until they are built (PROMPT-239).
const ACTIONS: QuickAction[] = [
  {
    href: '/studio/m/create',
    titleKey: 'promoPost',
    subtitleKey: 'promoPostDesc',
    primary: true,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    // Full width keeps the grid even (two wide cards + two rows of two)
    href: '/studio/m/creative',
    titleKey: 'creativeEdit',
    subtitleKey: 'creativeEditDesc',
    primary: true,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
      </svg>
    ),
  },
  {
    href: '/studio/m/library?mode=reel-select',
    titleKey: 'createReel',
    subtitleKey: 'createReelDesc',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="15" height="15" rx="2" />
        <path d="M17 7.5l5-3v13l-5-3" />
        <circle cx="9.5" cy="10.5" r="2" />
        <path d="M2 14l4-4 3 3 3-2 5 5" />
      </svg>
    ),
  },
  {
    href: '/studio/m/improve',
    titleKey: 'improvePhoto',
    subtitleKey: 'improvePhotoDesc',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l1.8 5.55H19.5l-4.65 3.38 1.77 5.45L12 13.1l-4.62 3.28 1.77-5.45L4.5 7.55h5.7z" />
      </svg>
    ),
  },
  {
    href: '/studio/m/remove-bg',
    titleKey: 'removeBg',
    subtitleKey: 'removeBgDesc',
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
    titleKey: 'upscale',
    subtitleKey: 'upscaleDesc',
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

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {ACTIONS.map((action) => (
        <ActionCard
          key={action.href}
          title={t(action.titleKey)}
          subtitle={t(action.subtitleKey)}
          href={action.href}
          icon={action.icon}
          primary={action.primary}
        />
      ))}
    </div>
  );
}
