'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { userKey } from '@/lib/user-storage';
import { MAX_REEL_PHOTOS, assessReelPhoto, readCtaLayout, readReelPhotos, writeCtaLayout, writeReelPhotos } from '@/lib/studio/mobile/reel';
import type { BrandKitData, ReelCtaLayout, ReelCtaLinePlacement, ReelCtaMotion, ReelPhoto, ReelPhotoStatus, ReelScoreResult } from '@/lib/types';
import { DEFAULT_REEL_CTA_MOTION, FONT_PRESETS, MOBILE_TEXT_COLORS, MOBILE_TEXT_FONTS, REEL_CTA_DURATION, REEL_CTA_FONT_SIZE, REEL_CTA_LAYOUT, REEL_CTA_MOTIONS } from '@/lib/constants';
import { loadGoogleFont } from '@/lib/fonts/font-loader';
import { operationCharge } from '@/lib/pricing';
import { ImproveBottomSheet } from './ImproveBottomSheet';
import { ColorSwatches, FontChips, SizeStepper } from './TextStylePanel';
import { startLayerGesture } from './DraggableTextLayer';
import { useBrandKit } from '@/hooks/useBrandKit';

const STATUS_STYLE: Record<ReelPhotoStatus, { tile: string; dot: string; label: 'statusGood' | 'statusImprove' | 'statusWeak'; hint: 'hintGood' | 'hintImprove' | 'hintWeak' }> = {
  green:  { tile: 'bg-green-500/20 border-green-500',   dot: 'bg-green-500',  label: 'statusGood',    hint: 'hintGood' },
  yellow: { tile: 'bg-yellow-500/20 border-yellow-500', dot: 'bg-yellow-500', label: 'statusImprove', hint: 'hintImprove' },
  red:    { tile: 'bg-red-500/20 border-red-500',       dot: 'bg-red-500',    label: 'statusWeak',    hint: 'hintWeak' },
};

const noopSubscribe = () => () => {};

// Same test as reel-service brand.js
const CYRILLIC = /[\u0400-\u04FF]/;
// CTA inputs are ~335px wide, the reel frame 1080px — the live preview scales the reel size down
const INPUT_PREVIEW_SCALE = 0.31;
const INPUT_PREVIEW_MIN_PX = 11;

const CTA_MOTION_LABELS: Record<ReelCtaMotion, 'ctaMotionNone' | 'ctaMotionSubtle' | 'ctaMotionMedium'> = {
  none: 'ctaMotionNone',
  subtle: 'ctaMotionSubtle',
  medium: 'ctaMotionMedium',
};

/** Family and weight reel-service draws a CTA line with (Cyrillic swaps a few families) */
function ctaFace(family: string, text: string): { family: string; weight: number } {
  const swap = REEL_CTA_LAYOUT.cyrillicFallback[family];
  if (swap && CYRILLIC.test(text)) return swap;
  return { family, weight: REEL_CTA_LAYOUT.weights[family] ?? REEL_CTA_LAYOUT.defaultWeight };
}

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
  // Text on the last (CTA) shot — prefilled from the Brand Kit (business name / CTA), else generic
  // defaults in the user's language. Always sent, so the reel shows what the user saw here.
  const { brandKit } = useBrandKit();
  const brand = brandKit?.enabled ? brandKit : null;
  const defaultCta1 = brand?.businessName.slice(0, 30) || t('ctaDefault1');
  const defaultCta2 = brand?.ctaText.slice(0, 30) || t('ctaDefault2');
  const [cta1, setCta1] = useState(defaultCta1);
  const [cta2, setCta2] = useState(defaultCta2);
  const [userEditedCta1, setUserEditedCta1] = useState(false);
  const [userEditedCta2, setUserEditedCta2] = useState(false);
  // CTA font and color follow the Brand Kit (it loads async) until the user picks one here.
  // The Brand Kit font leads the chips when it isn't one of the mobile fonts already.
  const brandFont = FONT_PRESETS.find((p) => p.id === brand?.fontPreset)?.fontFamily;
  const fontChips = useMemo(() => {
    const families: string[] = MOBILE_TEXT_FONTS.map((f) => f.family);
    return brandFont && !families.includes(brandFont) ? [brandFont, ...families] : families;
  }, [brandFont]);
  const [pickedFont, setPickedFont] = useState<string | null>(null);
  const ctaFontFamily = pickedFont ?? fontChips[0];
  const [ctaFontSize, setCtaFontSize] = useState<number>(REEL_CTA_FONT_SIZE.default);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Lines moved / resized on the preview — kept for the session (this screen renders client-only)
  const [ctaLayout, setCtaLayout] = useState<ReelCtaLayout>(readCtaLayout);
  useEffect(() => { writeCtaLayout(ctaLayout); }, [ctaLayout]);
  // The preview owns a history entry, so the phone's Back closes it instead of leaving the page
  useEffect(() => {
    if (!previewOpen) return;
    const onPop = () => setPreviewOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [previewOpen]);
  // How long the CTA shot stays on screen and how much it zooms (reel-service CTA_DURATION / CTA_MOTION)
  const [ctaDuration, setCtaDuration] = useState<number>(REEL_CTA_DURATION.default);
  const [ctaMotion, setCtaMotion] = useState<ReelCtaMotion>(DEFAULT_REEL_CTA_MOTION);
  // Only an explicit pick is sent — reel-service keeps its Brand Kit contrast rules otherwise
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const ctaColor = pickedColor ?? brand?.colorText ?? '#FFFFFF';
  // Brand Kit loaded or locale changed — refresh the fields the user hasn't typed in
  const [syncedDefaults, setSyncedDefaults] = useState(`${defaultCta1}\n${defaultCta2}`);
  if (syncedDefaults !== `${defaultCta1}\n${defaultCta2}`) {
    setSyncedDefaults(`${defaultCta1}\n${defaultCta2}`);
    if (!userEditedCta1) setCta1(defaultCta1);
    if (!userEditedCta2) setCta2(defaultCta2);
  }
  // Faces the styled CTA inputs need — the chips load only the picked family, not a Cyrillic swap
  useEffect(() => {
    for (const text of [cta1 || defaultCta1, cta2 || defaultCta2]) {
      const face = ctaFace(ctaFontFamily, text);
      loadGoogleFont(face.family, face.weight).catch(() => {});
    }
  }, [ctaFontFamily, cta1, cta2, defaultCta1, defaultCta2]);
  const [scoresExpanded, setScoresExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Back to the photo picker (header, "+", empty state). Coming from the picker its history entry is
  // right behind us, so go back like the system button does — pushing it again would grow the stack
  // library→check→library→… Entered elsewhere (Result "Use in Reel", reload): replace with the picker.
  function goToSelection() {
    const fromLibrary = new URLSearchParams(window.location.search).get('from') === 'library';
    if (fromLibrary && window.history.length > 1) router.back();
    else router.replace('/studio/m/library?select=1');
  }

  function openPreview() {
    // State-only entry (no URL) — Next copies its router state onto it, so Back restores this page
    window.history.pushState({ ctaPreview: true }, '');
    setPreviewOpen(true);
  }

  // ✕ / Escape pop our entry too — popstate then closes the overlay, like the phone's Back
  function closePreview() {
    if ((window.history.state as { ctaPreview?: boolean } | null)?.ctaPreview) window.history.back();
    else setPreviewOpen(false);
  }

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
        <button
          onClick={goToSelection}
          className="flex min-h-11 items-center rounded-2xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
        >
          {t('pickPhotos')}
        </button>
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
  const cyrillicUnsupported = CYRILLIC.test(`${cta1}${cta2}`)
    && MOBILE_TEXT_FONTS.some((f) => f.family === ctaFontFamily && !f.cyrillic);
  // reel-service puts the CTA on its hero photo — the best-scored one is the closest guess
  const heroPhoto = photos.reduce((best, p) => ((scoreOf(p)?.score ?? -1) > (scoreOf(best)?.score ?? -1) ? p : best), photos[0]);

  function inputStyle(text: string, reelSize: number): CSSProperties {
    const face = ctaFace(ctaFontFamily, text);
    return {
      fontFamily: `"${face.family}", sans-serif`,
      fontWeight: face.weight,
      color: ctaColor,
      fontSize: `${Math.max(INPUT_PREVIEW_MIN_PX, reelSize * INPUT_PREVIEW_SCALE)}px`,
    };
  }

  return (
    <div className="flex flex-col pb-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {previewOpen && (
        <CtaPreviewOverlay
          photoUrl={heroPhoto.url}
          line1={cta1.trim() || defaultCta1}
          line2={cta2.trim() || defaultCta2}
          fontFamily={ctaFontFamily}
          fontSize={ctaFontSize}
          pickedColor={pickedColor}
          brand={brand}
          layout={ctaLayout}
          onLayoutChange={setCtaLayout}
          onClose={closePreview}
        />
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={goToSelection}
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
          <button
            onClick={goToSelection}
            aria-label={t('addMore')}
            className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-gray-400 active:bg-white/[0.06]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
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
              <span className="mt-0.5 text-[10px] text-gray-500">{t('reelCreditsImage', { count: operationCharge('reel-image').amount })}</span>
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
              <span className="mt-0.5 text-[10px] text-gray-500">{t('reelCreditsVideo', { count: operationCharge('reel-video').amount })}</span>
            </button>
          </div>
        </div>

        {/* CTA text for the last shot */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{t('ctaTitle')}</p>
          <p className="text-[11px] text-gray-600">{t('ctaHint')}</p>
          {/* Styled like the reel draws them — line 1 is 4/3 of the chosen size there */}
          <input
            value={cta1}
            onChange={(e) => { setCta1(e.target.value); setUserEditedCta1(true); }}
            placeholder={defaultCta1}
            aria-label={t('ctaLine1')}
            maxLength={30}
            translate="no"
            style={inputStyle(cta1 || defaultCta1, ctaFontSize * REEL_CTA_LAYOUT.line1Ratio)}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white placeholder-gray-500 outline-none focus:border-green-500/50"
          />
          <input
            value={cta2}
            onChange={(e) => { setCta2(e.target.value); setUserEditedCta2(true); }}
            placeholder={defaultCta2}
            aria-label={t('ctaLine2')}
            maxLength={30}
            translate="no"
            style={inputStyle(cta2 || defaultCta2, ctaFontSize)}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white placeholder-gray-500 outline-none focus:border-green-500/50"
          />
        </div>

        {/* CTA font, size and color — the mobile text controls (TextStylePanel) */}
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('ctaFont')}</p>
          <FontChips
            value={ctaFontFamily}
            onChange={setPickedFont}
            fonts={fontChips}
            weight={REEL_CTA_LAYOUT.weights[ctaFontFamily] ?? REEL_CTA_LAYOUT.defaultWeight}
          />
          {cyrillicUnsupported && (
            <p className="pb-2 text-xs text-yellow-400/90" role="status">{t('cyrillicWarning')}</p>
          )}
          <div className="flex min-h-11 items-center gap-3 pb-2">
            <span className="w-16 text-xs text-gray-500">{t('ctaSize')}</span>
            <SizeStepper
              value={ctaFontSize}
              onChange={setCtaFontSize}
              min={REEL_CTA_FONT_SIZE.min}
              max={REEL_CTA_FONT_SIZE.max}
              step={REEL_CTA_FONT_SIZE.step}
            />
          </div>
          <p className="text-xs text-gray-500">{t('ctaColor')}</p>
          <ColorSwatches value={ctaColor} onChange={setPickedColor} colors={MOBILE_TEXT_COLORS} />
          <div className="flex min-h-11 items-center gap-3 pb-2">
            <span className="w-16 text-xs text-gray-500">{t('ctaDuration')}</span>
            <SizeStepper
              value={ctaDuration}
              // Tenths — repeated ±0.1 would otherwise drift to 3.2999999
              onChange={(v) => setCtaDuration(Math.round(v * 10) / 10)}
              min={REEL_CTA_DURATION.min}
              max={REEL_CTA_DURATION.max}
              step={REEL_CTA_DURATION.step}
              suffix={<span className="text-xs text-gray-500">s</span>}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-gray-500">{t('ctaMotion')}</span>
            <div className="flex flex-1 gap-2" role="radiogroup" aria-label={t('ctaMotion')}>
              {REEL_CTA_MOTIONS.map((motion) => (
                <button
                  key={motion}
                  role="radio"
                  aria-checked={ctaMotion === motion}
                  onClick={() => setCtaMotion(motion)}
                  className={`min-h-9 flex-1 rounded-lg border px-2 text-xs transition-colors ${
                    ctaMotion === motion
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-white/10 bg-white/[0.04] text-gray-300'
                  }`}
                >
                  {t(CTA_MOTION_LABELS[motion])}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={openPreview}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-gray-200 active:bg-white/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
          {t('ctaPreview')}
        </button>

        <button
          onClick={() => {
            try {
              sessionStorage.setItem(userKey('reel-mode'), reelMode);
              sessionStorage.setItem(userKey('reel-cta1'), cta1.trim());
              sessionStorage.setItem(userKey('reel-cta2'), cta2.trim());
              sessionStorage.setItem(userKey('reel-ctaFont'), ctaFontFamily);
              sessionStorage.setItem(userKey('reel-ctaFontSize'), String(ctaFontSize));
              sessionStorage.setItem(userKey('reel-ctaDuration'), String(ctaDuration));
              sessionStorage.setItem(userKey('reel-ctaMotion'), ctaMotion);
              if (pickedColor) sessionStorage.setItem(userKey('reel-ctaColor'), pickedColor);
              else sessionStorage.removeItem(userKey('reel-ctaColor'));
              const preferredMusic = localStorage.getItem(userKey('reel-preferred-music')) || 'warm-cafe';
              sessionStorage.setItem(userKey('reel-musicTrackId'), preferredMusic);
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

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
function hexOr(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value) ? value : fallback;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** reel-service fit(): the size ≤ max (≥ minSize) at which the line fits maxWidth, and its width */
function fitLine(text: string, max: number, face: { family: string; weight: number }, spacing: number, maxWidth: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return { size: max, width: maxWidth };
  measureCtx.font = `${face.weight} ${max}px "${face.family}", Arial, sans-serif`;
  const width = measureCtx.measureText(text).width + spacing * Math.max(0, text.length - 1);
  if (width <= maxWidth) return { size: max, width };
  const size = Math.max(REEL_CTA_LAYOUT.minSize, Math.floor(max * maxWidth / width));
  return { size, width: Math.min(maxWidth, Math.round(width * size / max)) };
}

interface CtaPreviewProps {
  photoUrl: string;
  line1: string;
  line2: string;
  fontFamily: string;
  /** Main CTA line in px at 1080 wide */
  fontSize: number;
  /** Only an explicit pick overrides the Brand Kit / default colors, as in reel-service */
  pickedColor: string | null;
  brand: BrandKitData | null;
  /** Lines the user moved / resized here; a missing line sits where reel-service puts it by default */
  layout: ReelCtaLayout;
  onLayoutChange: (layout: ReelCtaLayout) => void;
  onClose: () => void;
}

type CtaLineKey = 'line1' | 'line2';

interface CtaLineGroupProps {
  /** Center in % of the frame, as startLayerGesture expects */
  x: number;
  y: number;
  scale: number;
  /** Touch target / selection frame in frame units */
  box: { x: number; y: number; w: number; h: number };
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onScale: (scale: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/** One CTA line on the preview — a text overlay layer's drag / pinch / corner-resize in SVG */
function CtaLineGroup({ x, y, scale, box, isSelected, onSelect, onMove, onScale, containerRef, children }: CtaLineGroupProps) {
  const ref = useRef<SVGGElement>(null);
  function handleTouchStart(e: React.TouchEvent) {
    startLayerGesture(e, { x, y, scale, isSelected, onSelect, onMove, onScale, layerRef: ref, containerRef });
  }
  return (
    <g ref={ref} onTouchStart={handleTouchStart} style={{ touchAction: 'none', cursor: 'grab' }}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={16} fill="transparent"
        stroke={isSelected ? '#22c55e' : 'none'} strokeWidth={4} strokeDasharray="14 10" />
      {children}
      {isSelected && <circle cx={box.x + box.w} cy={box.y + box.h} r={26} fill="#22c55e" stroke="white" strokeWidth={4} />}
    </g>
  );
}

interface PlacedLine {
  size: number;
  width: number;
  /** Center in frame units (1080×1920) */
  cx: number;
  cy: number;
  scale: number;
}

/**
 * Approximate last reel frame: the same SVG overlay reel-service draws (REEL_CTA_LAYOUT) over the
 * best-scored photo. The real reel crops/outpaints the hero photo and animates it, so it can differ.
 * Both lines can be dragged / pinched like text overlay layers (startLayerGesture); reel-service
 * applies the result (ctaLayout) with the same placement maths as placeLine below.
 */
function CtaPreviewOverlay({ photoUrl, line1, line2, fontFamily, fontSize, pickedColor, brand, layout, onLayoutChange, onClose }: CtaPreviewProps) {
  const t = useTranslations('mobile.reel');
  const L = REEL_CTA_LAYOUT;
  const face1 = ctaFace(fontFamily, line1);
  const face2 = ctaFace(fontFamily, line2);
  const frameRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CtaLineKey | null>(null);
  // Re-measure once the faces are loaded — the canvas measures a fallback font before that
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([loadGoogleFont(face1.family, face1.weight), loadGoogleFont(face2.family, face2.weight)])
      .then(() => { if (!cancelled) setFontsReady((n) => n + 1); });
    return () => { cancelled = true; };
  }, [face1.family, face1.weight, face2.family, face2.weight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const max1 = Math.round(fontSize * L.line1Ratio);
  const placed = useMemo(() => {
    void fontsReady;
    const P = L.plain;
    const B = L.branded;
    /**
     * Default: reel-service's fixed spot (center = baseline − size × 0.35, or the pill's center).
     * Custom: center from the layout, size × scale, shrunk to fit the room left to the nearer edge.
     */
    function placeLine(
      key: CtaLineKey, text: string, max: number, face: { family: string; weight: number },
      spacing: number, maxWidth: number, padX: number, defaultCenterY: (size: number) => number,
    ): PlacedLine | null {
      if (!text) return null;
      const custom = layout[key];
      if (!custom) {
        const fit = fitLine(text, max, face, spacing, maxWidth);
        return { ...fit, cx: L.width / 2, cy: defaultCenterY(fit.size), scale: 1 };
      }
      const cx = custom.x * L.width;
      const room = 2 * Math.min(cx, L.width - cx) - padX - 2 * L.edgeMargin;
      const fit = fitLine(text, Math.round(max * custom.scale), face, spacing, Math.max(1, Math.min(maxWidth, room)));
      return { ...fit, cx, cy: custom.y * L.height, scale: custom.scale };
    }
    const off = L.baselineOffset;
    return brand
      ? {
          l1: placeLine('line1', line1, max1, face1, B.spacing1, B.line1MaxWidth, 0, (sz) => B.line1Y - sz * off),
          l2: placeLine('line2', line2, fontSize, face2, 0, B.pillMaxWidth, B.pillPaddingX,
            (sz) => B.pillBottom - Math.round(sz * B.pillHeightRatio) / 2),
        }
      : {
          l1: placeLine('line1', line1, max1, face1, P.spacing1, P.maxWidth, 0, (sz) => P.line1Y - sz * off),
          l2: placeLine('line2', line2, fontSize, face2, P.spacing2, P.maxWidth, 0, (sz) => P.line2Y - sz * off),
        };
  }, [brand, line1, line2, max1, fontSize, face1, face2, fontsReady, layout, L]);

  const { l1, l2 } = placed;

  function setPlacement(key: CtaLineKey, line: PlacedLine, change: Partial<ReelCtaLinePlacement>) {
    onLayoutChange({
      ...layout,
      [key]: { x: line.cx / L.width, y: line.cy / L.height, scale: line.scale, ...change },
    });
  }

  const shadow = (
    <filter id="ctaShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="5" floodColor="rgba(0,0,0,0.85)" />
    </filter>
  );
  const fontAttrs = (f: { family: string; weight: number }) => ({
    fontFamily: `'${f.family}', Arial, Helvetica, sans-serif`,
    fontWeight: f.weight,
  });
  const baseline = (line: PlacedLine) => Math.round(line.cy + line.size * L.baselineOffset);

  // A draggable / resizable line: same gestures as a text overlay layer
  function group(key: CtaLineKey, line: PlacedLine, box: { x: number; y: number; w: number; h: number }, content: ReactNode) {
    return (
      <CtaLineGroup
        key={key}
        x={(line.cx / L.width) * 100}
        y={(line.cy / L.height) * 100}
        scale={line.scale}
        box={box}
        isSelected={selected === key}
        onSelect={() => setSelected(key)}
        onMove={(x, y) => setPlacement(key, line, { x: x / 100, y: y / 100 })}
        onScale={(scale) => setPlacement(key, line, {
          scale: Math.min(Math.max(scale, L.placementScale.min), L.placementScale.max),
        })}
        containerRef={frameRef}
      >
        {content}
      </CtaLineGroup>
    );
  }
  const textBox = (line: PlacedLine) => ({
    x: line.cx - line.width / 2 - 24, y: line.cy - line.size * 0.75, w: line.width + 48, h: line.size * 1.5,
  });

  let overlay: ReactNode;
  if (!brand) {
    const P = L.plain;
    overlay = (
      <>
        <defs>
          <linearGradient id="ctaTopScrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.65" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ctaBottomScrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.70" />
          </linearGradient>
          {shadow}
        </defs>
        <rect x="0" y="0" width={L.width} height={P.topScrimHeight} fill="url(#ctaTopScrim)" />
        <rect x="0" y={P.bottomScrimY} width={L.width} height={L.height - P.bottomScrimY} fill="url(#ctaBottomScrim)" />
        {l1 && group('line1', l1, textBox(l1), (
          <text x={l1.cx} y={baseline(l1)} {...fontAttrs(face1)} fontSize={l1.size} fill={pickedColor ?? 'white'}
            textAnchor="middle" filter="url(#ctaShadow)" letterSpacing={P.spacing1}>{line1}</text>
        ))}
        {l2 && group('line2', l2, textBox(l2), (
          <text x={l2.cx} y={baseline(l2)} {...fontAttrs(face2)} fontSize={l2.size} fill={pickedColor ?? 'rgba(255,255,255,0.95)'}
            textAnchor="middle" filter="url(#ctaShadow)" letterSpacing={P.spacing2}>{line2}</text>
        ))}
      </>
    );
  } else {
    const B = L.branded;
    const primary = hexOr(brand.colorPrimary, '#16A34A');
    const secondary = hexOr(brand.colorSecondary, '#000000');
    const textColor = pickedColor ?? hexOr(brand.colorText, '#FFFFFF');
    // A dark brand text color would vanish on the top scrim — reel-service uses white there
    const topColor = pickedColor ?? (luminance(textColor) > 0.5 ? textColor : '#FFFFFF');
    const pillH = l2 ? Math.round(l2.size * B.pillHeightRatio) : 0;
    const pillW = l2 ? l2.width + B.pillPaddingX : 0;
    overlay = (
      <>
        <defs>
          <linearGradient id="ctaTopScrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.65" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ctaBottomScrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={secondary} stopOpacity="0" />
            <stop offset="100%" stopColor={secondary} stopOpacity="0.55" />
          </linearGradient>
          {shadow}
        </defs>
        {l1 && <rect x="0" y="0" width={L.width} height={B.line1Y + B.topScrimExtra} fill="url(#ctaTopScrim)" />}
        <rect x="0" y={L.height - B.bottomScrimHeight} width={L.width} height={B.bottomScrimHeight} fill="url(#ctaBottomScrim)" />
        {l1 && group('line1', l1, textBox(l1), (
          <text x={l1.cx} y={baseline(l1)} {...fontAttrs(face1)} fontSize={l1.size} fill={topColor}
            textAnchor="middle" filter="url(#ctaShadow)" letterSpacing={B.spacing1}>{line1}</text>
        ))}
        {l2 && group('line2', l2,
          { x: l2.cx - pillW / 2 - 8, y: l2.cy - pillH / 2 - 8, w: pillW + 16, h: pillH + 16 }, (
          <>
            <rect x={l2.cx - pillW / 2} y={l2.cy - pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={primary} filter="url(#ctaShadow)" />
            <text x={l2.cx} y={baseline(l2)} {...fontAttrs(face2)} fontSize={l2.size}
              fill={textColor} textAnchor="middle">{line2}</text>
          </>
        ))}
      </>
    );
  }

  // Logo watermark (brand.js overlayLogoWatermark) — same clamps as reel-service
  const logo = brand?.watermarkEnabled && brand.logoUrl ? brand.logoUrl : null;
  const logoScale = Math.min(Math.max(Number(brand?.watermarkScale) || 0.10, 0.05), 0.25);
  const logoOpacity = Math.min(Math.max(Number(brand?.watermarkOpacity) || 0.15, 0), 1);
  const logoPos = brand?.watermarkPosition ?? 'bottom-right';
  const logoStyle: CSSProperties = {
    width: `${logoScale * 100}%`,
    opacity: logoOpacity,
    [logoPos.endsWith('left') ? 'left' : 'right']: `${(L.logo.sides / L.width) * 100}%`,
    [logoPos.startsWith('top') ? 'top' : 'bottom']: `${((logoPos.startsWith('top') ? L.logo.top : L.logo.bottom) / L.height) * 100}%`,
  };
  const customised = Boolean(layout.line1 || layout.line2);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('ctaPreview')}
      style={{ animation: 'fade-in 0.2s ease-out' }}
    >
      <button
        onClick={onClose}
        aria-label={t('ctaPreviewClose')}
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div
        ref={frameRef}
        className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black shadow-2xl"
        style={{ height: 'min(74dvh, calc((100vw - 2rem) * 16 / 9))' }}
        translate="no"
      >
        <svg
          viewBox={`0 0 ${L.width} ${L.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={t('ctaPreview')}
          style={{ touchAction: 'none' }}
          // Lines stop propagation — a touch that reaches the frame itself deselects
          onTouchStart={() => setSelected(null)}
        >
          <image href={photoUrl} x="0" y="0" width={L.width} height={L.height} preserveAspectRatio="xMidYMid slice" />
          {overlay}
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img src={logo} alt="" className="pointer-events-none absolute h-auto" style={logoStyle} />}
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">{t('ctaPreviewHint')}</p>
      <div className="mt-1 flex items-center gap-3 text-xs">
        <span className="text-gray-500">{t('ctaPreviewApprox')}</span>
        {customised && (
          <button onClick={() => { setSelected(null); onLayoutChange({}); }} className="min-h-9 px-2 font-medium text-green-400 active:text-green-300">
            {t('ctaPreviewReset')}
          </button>
        )}
      </div>
    </div>
  );
}
