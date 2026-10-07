'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Phase 1 placeholder — Phase 2 calls the reel-lab API here and shows the video
export function ReelGenerating() {
  const t = useTranslations('mobile.reel');
  const router = useRouter();
  const [status, setStatus] = useState<'generating' | 'done'>('generating');

  useEffect(() => {
    const timer = setTimeout(() => setStatus('done'), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-24 text-center" role="status" aria-live="polite">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="text-lg font-medium text-white">{t('generating')}</p>
        <p className="mt-2 text-sm text-gray-400">{t('generatingHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20 text-green-400">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1V5z" />
        </svg>
      </span>
      <h2 className="mb-2 text-xl font-bold text-white">{t('comingSoon')}</h2>
      <p className="mb-8 text-sm text-gray-400">{t('comingSoonDesc')}</p>
      <button
        onClick={() => router.push('/studio/m/library')}
        className="flex min-h-11 items-center rounded-xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
      >
        {t('backToLibrary')}
      </button>
    </div>
  );
}
