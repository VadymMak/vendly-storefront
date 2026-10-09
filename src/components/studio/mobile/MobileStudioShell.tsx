'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileLanguageSwitcher } from './MobileLanguageSwitcher';
import { MobileAccountMenu } from './MobileAccountMenu';
import { CREDITS_CHANGED_EVENT } from '@/lib/studio/credits-events';

interface CreditStatus {
  plan: string;
  superuser?: boolean;
  byokUnlimited?: boolean;
  monthly: { images: { remaining: number }; videos: { remaining: number } };
  bonus: { images: number; videos: number };
}

interface Props {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

export function MobileStudioShell({ userId, userEmail, children }: Props) {
  const t = useTranslations('mobile.shell');
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const pathname = usePathname();

  const loadCredits = useCallback(() => {
    fetch('/api/studio/credits')
      .then(r => (r.ok ? r.json() as Promise<CreditStatus> : null))
      .then((data) => { if (data?.monthly) setCreditStatus(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Refetch on every screen change and whenever a tool reports it spent credits
  useEffect(() => { loadCredits(); }, [userId, pathname, loadCredits]);

  useEffect(() => {
    window.addEventListener(CREDITS_CHANGED_EVENT, loadCredits);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, loadCredits);
  }, [loadCredits]);

  const creditsLabel = (() => {
    if (!creditStatus) return null;
    if (creditStatus.superuser || creditStatus.byokUnlimited) return '∞';
    const total = creditStatus.monthly.images.remaining + creditStatus.bonus.images;
    return String(total);
  })();

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0f]/95 px-4 backdrop-blur-md">
        <Link href="/studio/m" className="text-base font-bold text-white">
          {t('title')}
        </Link>
        <div className="flex items-center gap-2">
          {creditsLabel !== null && (
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-gray-300">
              <span className="font-semibold text-green-400">{creditsLabel}</span>
              {creditsLabel !== '∞' && <span className="ml-0.5 text-gray-500">{t('credits')}</span>}
            </span>
          )}
          <MobileLanguageSwitcher />
          <MobileAccountMenu userEmail={userEmail} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
