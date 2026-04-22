'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { COOKIE_ACCEPTED_KEY } from '@/lib/constants';

export default function CookieBanner() {
  const t = useTranslations('cookie');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_ACCEPTED_KEY)) setVisible(true);
    } catch {}
  }, []);

  const accept = () => {
    try { localStorage.setItem(COOKIE_ACCEPTED_KEY, '1'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[--color-bg]/95 backdrop-blur-md px-4 py-3 sm:py-4"
      role="region"
      aria-label="Cookie notice"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[13px] leading-relaxed text-[--color-text-muted]">
          {t('text')}{' '}
          <a
            href="/legal/privacy"
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {t('link')}
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark cursor-pointer"
        >
          {t('btn')}
        </button>
      </div>
    </div>
  );
}
