'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { MAX_REEL_PHOTOS, assessReelPhoto, readReelPhotos, writeReelPhotos } from '@/lib/studio/mobile/reel';
import type { ReelPhoto, ReelPhotoStatus, ReelScoreResult } from '@/lib/types';
import { ImproveBottomSheet } from './ImproveBottomSheet';

const STATUS_STYLE: Record<ReelPhotoStatus, { tile: string; dot: string; label: 'statusGood' | 'statusImprove' | 'statusWeak'; hint: 'hintGood' | 'hintImprove' | 'hintWeak' }> = {
  green:  { tile: 'bg-green-500/20 border-green-500',   dot: 'bg-green-500',  label: 'statusGood',    hint: 'hintGood' },
  yellow: { tile: 'bg-yellow-500/20 border-yellow-500', dot: 'bg-yellow-500', label: 'statusImprove', hint: 'hintImprove' },
  red:    { tile: 'bg-red-500/20 border-red-500',       dot: 'bg-red-500',    label: 'statusWeak',    hint: 'hintWeak' },
};

const noopSubscribe = () => () => {};

// How long the first yellow photo stays highlighted before the Improve sheet opens
const IMPROVE_HIGHLIGHT_MS = 700;

/** Scores by image URL — an improved photo gets a new URL and is scored again. 'failed' = reel-service unreachable */
type ScoreMap = Record<string, ReelScoreResult | 'failed'>;

async function fetchRealScores(photos: ReelPhoto[]): Promise<ReelScoreResult[]> {
  const res = await fetch('/api/reel/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: photos.map((p) => ({ imageUrl: p.url, imageId: p.id })) }),
  });
  if (!res.ok) throw new Error(`reel score ${res.status}`);
  const data = await res.json() as { results?: ReelScoreResult[] };
  if (!Array.isArray(data.results)) throw new Error('reel score: no results');
  return data.results;
}

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
  const locale = useLocale();
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
  const [scores, setScores] = useState<ScoreMap>({});
  const scoringUrls = useRef(new Set<string>());
  const [reelMode, setReelMode] = useState<'images' | 'video'>('images');
  // Text on the last (CTA) shot — prefilled in the user's language
  const [cta1, setCta1] = useState(() => t('ctaDefault1'));
  const [cta2, setCta2] = useState(() => t('ctaDefault2'));
  const [userEditedCta1, setUserEditedCta1] = useState(false);
  const [userEditedCta2, setUserEditedCta2] = useState(false);
  const [scoresExpanded, setScoresExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync CTA defaults when locale changes (only if user hasn't manually edited)
  useEffect(() => {
    if (!userEditedCta1) setCta1(t('ctaDefault1'));
    if (!userEditedCta2) setCta2(t('ctaDefault2'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Clear selection 1.5s after improve queue empties
  useEffect(() => {
    if (improveQueue.length === 0 && selectedIds.size > 0) {
      const timer = setTimeout(() => setSelectedIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [improveQueue.length]);

  // Score every photo URL not scored yet (on mount, after "+", after Improve replaced a URL)
  useEffect(() => {
    const pending = photos.filter((p, i) =>
      !(p.url in scores) && !scoringUrls.current.has(p.url) && photos.findIndex((q) => q.url === p.url) === i);
    if (pending.length === 0) return;
    pending.forEach((p) => scoringUrls.current.add(p.url));
    const done = (entries: [string, ReelScoreResult | 'failed'][]) => {
      pending.forEach((p) => scoringUrls.current.delete(p.url));
      setScores((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };
    fetchRealScores(pending)
      .then((results) => done(pending.map((p) => [p.url, results.find((r) => r.imageId === p.id) ?? 'failed'])))
      .catch((e) => {
        console.error('[reel score]', e);
        done(pending.map((p) => [p.url, 'failed']));
      });
  }, [photos, scores]);

  function scoreOf(photo: ReelPhoto): ReelScoreResult | null {
    const s = scores[photo.url];
    return s && s !== 'failed' && !s.error && s.status ? s : null;
  }

  // Real appeal score when available, else the operation-type estimate
  function statusOf(photo: ReelPhoto): ReelPhotoStatus {
    return scoreOf(photo)?.status ?? assessReelPhoto(photo);
  }

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select and flash the first photo to improve, then open the sheet for each in order
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

  // ── Computed values needed by the hook (MUST be before early returns) ──
  const scoring = photos.some((p) => !(p.url in scores));
  const allGreen = !scoring && photos.length > 0 && photos.every((p) => statusOf(p) === 'green');

  // Auto-collapse thumbnails when all photos are green — hook BEFORE early returns
  useEffect(() => {
    if (allGreen) setScoresExpanded(false);
  }, [allGreen]);

  // ── Early returns ──
  const improving = photos.find((p) => p.id === improveQueue[0]);
  if (improving) {
    if (!improving.url) {
      // Skip photos with no URL rather than crashing
      setImproveQueue((q) => q.slice(1));
    } else {
      return (
        <ImproveBottomSheet
          key={improving.id}
          imageUrl={improving.url}
          onDone={(improvedUrl) => {
            update(photos.map((p) => (p.id === improving.id ? { ...p, url: improvedUrl, operation: 'ai-edit' } : p)));
            setActiveId(improving.id);
            setImproveQueue((q) => q.slice(1));
          }}
          onCancel={() => setImproveQueue([])}
        />
      );
    }
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

  // ── Remaining computed values (only needed for the main render) ──
  const activeIndex = Math.max(0, photos.findIndex((p) => p.id === activeId));
  const active = photos[activeIndex];
  const activeScore = scoreOf(active);
  const activeStatus = STATUS_STYLE[statusOf(active)];
  const allImproveIds = photos.filter((p) => statusOf(p) !== 'green').map((p) => p.id);
  const activeImproveIds = selectedIds.size > 0
    ? Array.from(selectedIds).filter((id) => allImproveIds.includes(id))
    : allImproveIds;
  const scoreUnavailable = photos.some((p) => p.url in scores && !scoreOf(p));

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

      {/* All-green collapsed banner */}
      {allGreen && !scoresExpanded && (
        <button
          onClick={() => setScoresExpanded(true)}
          className="mx-4 mt-3 p-3 bg-green-500/10 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <span className="text-green-300 text-sm">{t('allPhotosReady')}</span>
          </div>
          <span className="text-white/30 text-xs">{t('tapToSeeScores')}</span>
        </button>
      )}

      {/* Thumbnails */}
      {(!allGreen || scoresExpanded) && (
      <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-3">
        {photos.map((photo) => {
          const style = STATUS_STYLE[statusOf(photo)];
          const photoScore = scoreOf(photo);
          const photoScoring = !(photo.url in scores);
          return (
            <div key={photo.id} className="relative shrink-0">
              <button
                ref={(el) => {
                  if (el) thumbRefs.current.set(photo.id, el);
                  else thumbRefs.current.delete(photo.id);
                }}
                onClick={() => {
                  setActiveId(photo.id);
                  if (statusOf(photo) !== 'green') toggleSelect(photo.id);
                }}
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
                {photoScoring ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40" aria-hidden="true">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </span>
                ) : (
                  <span className={`absolute bottom-1.5 left-1.5 h-3 w-3 rounded-full border border-black/40 ${style.dot}`} aria-hidden="true" />
                )}
                {photoScore?.score !== undefined && (
                  <span className="absolute top-1 left-1 rounded-md bg-black/70 px-1 text-[11px] font-semibold leading-4 text-white">
                    {photoScore.score.toFixed(1)}
                  </span>
                )}
                {selectedIds.has(photo.id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/30 rounded-xl" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
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
      )}

      {/* Preview */}
      <div className="px-4">
        <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.url} alt="" className="mx-auto max-h-[45dvh] w-auto object-contain" />
        </div>
      </div>

      {/* Status */}
      <div className="px-4 pt-4" role="status">
        {!(active.url in scores) ? (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-green-500" aria-hidden="true" />
            {t('scoring')}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className={`h-2.5 w-2.5 rounded-full ${activeStatus.dot}`} aria-hidden="true" />
              {t(activeStatus.label)}
              {activeScore?.score !== undefined && <span className="font-normal text-gray-400">· {activeScore.score.toFixed(1)}</span>}
            </p>
            <p className="mt-1 text-sm text-gray-400">{t(activeStatus.hint)}</p>
          </>
        )}
        {scoreUnavailable && (
          <p className="mt-2 text-xs text-yellow-400/80">{t('scoreUnavailable')}</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-3 px-4">
        {!scoring && allImproveIds.length > 0 && (
          <button
            onClick={() => startImprove(activeImproveIds)}
            disabled={highlightId !== null || activeImproveIds.length === 0}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 py-3.5 text-sm font-semibold text-yellow-300 active:bg-yellow-500/20 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
            {selectedIds.size > 0
              ? t('improveN', { count: activeImproveIds.length })
              : t('improveAll', { count: allImproveIds.length })
            }
          </button>
        )}

        {/* Mode toggle */}
        <div>
          <p className="mb-2 text-center text-xs text-gray-400">{t('modeLabel')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setReelMode('images')}
              className={`flex flex-1 flex-col items-center rounded-xl border py-2.5 text-sm font-medium transition-all ${
                reelMode === 'images'
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              <span className="mb-0.5 text-base" aria-hidden="true">🖼️</span>
              {t('modeImages')}
              <span className="mt-0.5 text-[10px] text-gray-500">~$0.08–0.12</span>
            </button>
            <button
              onClick={() => setReelMode('video')}
              className={`flex flex-1 flex-col items-center rounded-xl border py-2.5 text-sm font-medium transition-all ${
                reelMode === 'video'
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              <span className="mb-0.5 text-base" aria-hidden="true">🎬</span>
              {t('modeVideo')}
              <span className="mt-0.5 text-[10px] text-gray-500">~$0.40–0.55</span>
            </button>
          </div>
        </div>

        {/* CTA text for the last shot */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{t('ctaTitle')}</p>
          <p className="text-[11px] text-gray-600">{t('ctaHint')}</p>
          <input
            value={cta1}
            onChange={(e) => { setCta1(e.target.value); setUserEditedCta1(true); }}
            placeholder={t('ctaDefault1')}
            aria-label={t('ctaLine1')}
            maxLength={30}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50"
          />
          <input
            value={cta2}
            onChange={(e) => { setCta2(e.target.value); setUserEditedCta2(true); }}
            placeholder={t('ctaDefault2')}
            aria-label={t('ctaLine2')}
            maxLength={30}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50"
          />
        </div>

        <button
          onClick={() => {
            try {
              sessionStorage.setItem('reel-mode', reelMode);
              sessionStorage.setItem('reel-cta1', cta1.trim());
              sessionStorage.setItem('reel-cta2', cta2.trim());
              const preferredMusic = localStorage.getItem('reel-preferred-music') || 'warm-cafe';
              sessionStorage.setItem('reel-musicTrackId', preferredMusic);
            } catch {}
            router.push('/studio/m/reel/generate');
          }}
          disabled={scoring}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white active:bg-green-700 disabled:opacity-50"
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
