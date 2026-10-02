'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { StudioWorkItem, StudioWorkPage } from '@/lib/types';
import { QuickActionGrid } from './QuickActionGrid';

interface Props {
  userId: string;
}

export function MobileHome({ userId: _userId }: Props) {
  const t = useTranslations('mobile.home');
  // null = still loading. Images only: every thumbnail opens the Editor Hub.
  const [recent, setRecent] = useState<StudioWorkItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/studio/my-work?limit=10&type=image')
      .then((r) => (r.ok ? r.json() as Promise<StudioWorkPage> : { items: [], nextCursor: null }))
      .then((data) => { if (!cancelled) setRecent(data.items ?? []); })
      .catch(() => { if (!cancelled) setRecent([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6 py-5">
      {/* Hero greeting */}
      <div className="px-4">
        <h1 className="text-lg font-bold text-white">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Quick actions grid */}
      <QuickActionGrid />

      {/* Recent creations — hidden once loaded if there are none */}
      {(recent === null || recent.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-sm font-semibold text-white">{t('recent')}</h2>
            <Link href="/studio/m/library" className="text-xs text-green-500">
              {t('seeAll')}
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1">
            {recent === null
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
                ))
              : recent.map((item) => (
                  <Link
                    key={item.id}
                    href={`/studio/m/result/${item.id}`}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] active:scale-[0.97]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.prompt || ''}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ))}
          </div>
        </div>
      )}

      {/* Desktop studio link */}
      <div className="px-4 pb-4 text-center">
        <Link
          href="/studio?force=desktop"
          className="text-xs text-gray-500 underline underline-offset-2"
        >
          {t('desktopLink')}
        </Link>
      </div>
    </div>
  );
}
