'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MAX_REEL_PHOTOS, assessReelPhoto, readReelPhotos, writeReelPhotos } from '@/lib/studio/mobile/reel';
import type { ReelPhoto, ReelPhotoStatus } from '@/lib/types';
import { ImproveBottomSheet } from './ImproveBottomSheet';

const STATUS_STYLE: Record<ReelPhotoStatus, { tile: string; dot: string; label: 'statusGood' | 'statusImprove' | 'statusWeak'; hint: 'hintGood' | 'hintImprove' | 'hintWeak' }> = {
  green:  { tile: 'bg-green-500/20 border-green-500',   dot: 'bg-green-500',  label: 'statusGood',    hint: 'hintGood' },
  yellow: { tile: 'bg-yellow-500/20 border-yellow-500', dot: 'bg-yellow-500', label: 'statusImprove', hint: 'hintImprove' },
  red:    { tile: 'bg-red-500/20 border-red-500',       dot: 'bg-red-500',    label: 'statusWeak',    hint: 'hintWeak' },
};

const noopSubscribe = () => () => {};

// How long the first yellow photo stays highlighted before the Improve sheet opens
const IMPROVE_HIGHLIGHT_MS = 700;

// The photo list lives in sessionStorage — render the screen only once on the client
export function ReelQualityCheck() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
      </div>
    );
  }
  return <QualityCheck initialPhotos={readReelPhotos()} />;
}

function QualityCheck({ initialPhotos }: { initialPhotos: ReelPhoto[] }) {
  const t = useTranslations('mobile.reel');
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [activeId, setActiveId] = useState<string | null>(initialPhotos[0]?.id ?? null);
  // Ids still waiting for Improve, in order — the head one has the sheet open
  const [improveQueue, setImproveQueue] = useState<string[]>([]);
  // Photo flashed after tapping Improve, so the user sees which one the sheet is about to open
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());
  const sheetOpen = improveQueue.length > 0;

  // Keep the selected thumbnail in view — also when the strip remounts after the Improve sheet closes
  useEffect(() => {
    if (!activeId || sheetOpen) return;
    thumbRefs.current.get(activeId)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId, sheetOpen]);

  useEffect(() => () => {
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
  }, []);

  function update(next: ReelPhoto[]) {
    setPhotos(next);
    writeReelPhotos(next);
  }

  function remove(id: string) {
    const next = photos.filter((p) => p.id !== id);
    update(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }

  // Select and flash the first yellow photo, then open the sheet for the yellow ones in order
  function startImprove(ids: string[]) {
    if (ids.length === 0 || highlightId) return;
    setActiveId(ids[0]);
    setHighlightId(ids[0]);
    highlightTimer.current = window.setTimeout(() => {
      highlightTimer.current = null;
      setHighlightId(null);
      setImproveQueue(ids);
    }, IMPROVE_HIGHLIGHT_MS);
  }

  const improving = photos.find((p) => p.id === improveQueue[0]);
  if (improving) {
    return (
      <ImproveBottomSheet
        imageUrl={improving.url}
        onDone={(improvedUrl) => {
          // Improved = AI-finished: the photo turns green
          update(photos.map((p) => (p.id === improving.id ? { ...p, url: improvedUrl, operation: 'ai-edit' } : p)));
          setActiveId(improving.id);
          setImproveQueue((q) => q.slice(1));
        }}
        // Cancel stops the whole queue — the user is back on the check screen to decide
        onCancel={() => setImproveQueue([])}
      />
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
        <p className="text-base font-semibold text-white">{t('emptyCheck')}</p>
        <Link
          href="/studio/m/library?select=1"
          className="flex min-h-11 items-center rounded-2xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
        >
          {t('pickPhotos')}
        </Link>
      </div>
    );
  }

  // A stale id (removed photo) falls back to the first one — status, preview and counter all follow `active`
  const activeIndex = Math.max(0, photos.findIndex((p) => p.id === activeId));
  const active = photos[activeIndex];
  const activeStatus = STATUS_STYLE[assessReelPhoto(active)];
  const yellowIds = photos.filter((p) => assessReelPhoto(p) === 'yellow').map((p) => p.id);

  return (
    <div className="flex flex-col pb-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={() => router.push('/studio/m/library')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label={t('back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-white">{t('qualityCheck')}</h1>
        <span className="text-sm text-gray-400">{activeIndex + 1}/{photos.length}</span>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-3">
        {photos.map((photo) => {
          const style = STATUS_STYLE[assessReelPhoto(photo)];
          return (
            <div key={photo.id} className="relative shrink-0">
              <button
                ref={(el) => {
                  if (el) thumbRefs.current.set(photo.id, el);
                  else thumbRefs.current.delete(photo.id);
                }}
                onClick={() => setActiveId(photo.id)}
                aria-pressed={photo.id === active.id}
                aria-label={t(style.label)}
                className={`block h-20 w-16 overflow-hidden rounded-xl border-2 ${style.tile} ${
                  photo.id === highlightId
                    ? 'animate-pulse ring-4 ring-yellow-400'
                    : photo.id === active.id ? 'ring-2 ring-white/60' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                <span className={`absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full border border-black/40 ${style.dot}`} aria-hidden="true" />
              </button>
              <button
                onClick={() => remove(photo.id)}
                aria-label={t('remove')}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
        {photos.length < MAX_REEL_PHOTOS && (
          <Link
            href="/studio/m/library?select=1"
            aria-label={t('addMore')}
            className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-gray-400 active:bg-white/[0.06]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        )}
      </div>

      {/* Preview */}
      <div className="px-4">
        <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.url} alt="" className="mx-auto max-h-[45dvh] w-auto object-contain" />
        </div>
      </div>

      {/* Status */}
      <div className="px-4 pt-4" role="status">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className={`h-2.5 w-2.5 rounded-full ${activeStatus.dot}`} aria-hidden="true" />
          {t(activeStatus.label)}
        </p>
        <p className="mt-1 text-sm text-gray-400">{t(activeStatus.hint)}</p>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-3 px-4">
        {yellowIds.length > 0 && (
          <button
            onClick={() => startImprove(yellowIds)}
            disabled={highlightId !== null}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 py-3.5 text-sm font-semibold text-yellow-300 active:bg-yellow-500/20 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
            {t('improveN', { count: yellowIds.length })}
          </button>
        )}
        <button
          onClick={() => router.push('/studio/m/reel/generate')}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1V5z" />
          </svg>
          {t('createReel')}
        </button>
      </div>
    </div>
  );
}
