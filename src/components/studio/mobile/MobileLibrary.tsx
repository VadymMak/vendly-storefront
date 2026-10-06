'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { StudioWorkItem, StudioWorkPage } from '@/lib/types';

type Filter = 'all' | 'image' | 'video';

const PAGE_SIZE = 30;
const FILTERS: { id: Filter; key: 'filterAll' | 'filterImages' | 'filterVideos' }[] = [
  { id: 'all', key: 'filterAll' },
  { id: 'image', key: 'filterImages' },
  { id: 'video', key: 'filterVideos' },
];

async function fetchWork(filter: Filter, cursor?: string): Promise<StudioWorkPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filter !== 'all') params.set('type', filter);
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/studio/my-work?${params}`);
  if (!res.ok) throw new Error(`my-work ${res.status}`);
  return res.json() as Promise<StudioWorkPage>;
}

interface Loaded {
  filter: Filter;
  items: StudioWorkItem[];
  nextCursor: string | null;
  error: boolean;
}

export function MobileLibrary() {
  const t = useTranslations('mobile.library');
  const [filter, setFilter] = useState<Filter>('all');
  // Data is tagged with the filter it was loaded for — a mismatch means a load is in flight
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Items whose media failed to load (expired blob, deleted file) — dropped from the grid
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());
  const loading = loaded?.filter !== filter;
  const visibleItems = loaded ? loaded.items.filter((item) => !brokenIds.has(item.id)) : [];

  function markBroken(id: string) {
    setBrokenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  useEffect(() => {
    let cancelled = false;
    fetchWork(filter)
      .then((d) => { if (!cancelled) setLoaded({ filter, items: d.items, nextCursor: d.nextCursor, error: false }); })
      .catch(() => { if (!cancelled) setLoaded({ filter, items: [], nextCursor: null, error: true }); });
    return () => { cancelled = true; };
  }, [filter, reloadKey]);

  async function loadMore() {
    if (!loaded?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchWork(loaded.filter, loaded.nextCursor);
      setLoaded((prev) => (prev && prev.filter === loaded.filter
        ? { ...prev, items: [...prev.items, ...d.items], nextCursor: d.nextCursor }
        : prev));
    } catch {
      // keep what we have; the button stays so the user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col pb-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link
          href="/studio/m"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label={t('back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-white">{t('title')}</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pb-3" role="tablist">
        {FILTERS.map(({ id, key }) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
              filter === id ? 'bg-green-600 text-white' : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
            }`}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-0.5" aria-busy="true">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/[0.06]" />
          ))}
        </div>
      ) : loaded.error ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="text-sm text-gray-400">{t('error')}</p>
          <button
            onClick={() => { setLoaded(null); setReloadKey((k) => k + 1); }}
            className="min-h-11 rounded-full border border-white/10 px-6 text-sm text-gray-300"
          >
            {t('retry')}
          </button>
        </div>
      ) : visibleItems.length === 0 && !loaded.nextCursor ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="text-base font-semibold text-white">{t('empty')}</p>
          <Link
            href="/studio/m/create"
            className="flex min-h-11 items-center rounded-2xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('emptyAction')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-0.5">
            {visibleItems.map((item) =>
              item.type === 'video' ? (
                // Videos open the file itself — the Editor Hub is image-only
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square overflow-hidden bg-white/[0.04]"
                  aria-label={t('videoLabel')}
                >
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline onError={() => markBroken(item.id)} className="h-full w-full object-cover" />
                  <span className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </span>
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={`/studio/m/result/${item.id}`}
                  className="relative aspect-square overflow-hidden bg-white/[0.04] active:opacity-80"
                >
                  {/* Generic alt — the prompt must never leak into the page as fallback text */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={t('imageLabel')} loading="lazy" onError={() => markBroken(item.id)} className="h-full w-full object-cover" />
                </Link>
              ),
            )}
          </div>

          {loaded.nextCursor && (
            <div className="flex justify-center px-4 pt-5">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 text-sm text-gray-300 active:bg-white/[0.08] disabled:opacity-60"
              >
                {loadingMore && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />}
                {t('loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
