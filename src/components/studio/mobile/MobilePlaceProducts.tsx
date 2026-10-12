'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PlacedObject, StudioWorkItem, StudioWorkPage } from '@/lib/types';
import { CREDIT_COSTS } from '@/lib/constants';
import { MobileMediaPicker } from './MobileMediaPicker';
import { ImproveBottomSheet } from './ImproveBottomSheet';
import { BeforeAfterSlider } from '@/components/studio/editors/shared/BeforeAfterSlider';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';
import { downloadImage, fileFromUrl, proxyUrl, shareImage } from '@/lib/studio/mobile/share';
import { canvasSizeFor, clamp, fitScale, getObjBounds, ptDist, twoFingerDelta, type Point } from '@/lib/place-products/geometry';
import {
  BlendError, canvasToBlob, drawScene, generateEdgeMask, loadImg, requestAiBlend, saveComposite,
} from '@/lib/place-products/canvas';

type Step = 'pick-bg' | 'edit' | 'processing' | 'result' | 'improve';

// 2× the desktop canvas: sharp on Retina and a better input for AI Blend
const CANVAS_MAX = 1600;
// Scale limits relative to the initial fit, so the product can't vanish or pixelate badly
const MIN_SCALE_FACTOR = 0.1;
const MAX_SCALE_FACTOR = 3;
const MAX_HISTORY = 20;
// Corner handles, in CSS px (converted to canvas px at draw / hit time): 28px dot, 44px target
const MOBILE_HANDLE_RADIUS = 14;
const MOBILE_HANDLE_HIT_RADIUS = 22;

interface Gesture {
  checkpointed: boolean;
  start: PlacedObject;
  /** One finger: start pointer position (client px) */
  startPtr?: Point;
  /** Two fingers: start positions of both pointers (client px) */
  startA?: Point;
  startB?: Point;
  /** Corner resize: opposite corner stays put (canvas px) */
  resize?: { anchor: Point; startDist: number };
}

/** Canvas px per CSS px — the 1600px canvas is shown much smaller on a phone. */
function canvasScale(canvas: HTMLCanvasElement): number {
  const w = canvas.getBoundingClientRect().width;
  return w > 0 ? canvas.width / w : 1;
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const r = canvas.getBoundingClientRect();
  const k = canvasScale(canvas);
  return { x: (clientX - r.left) * k, y: (clientY - r.top) * k };
}

interface Props {
  cutoutUrl: string | null;
}

export function MobilePlaceProducts({ cutoutUrl }: Props) {
  const t = useTranslations('mobile.placeProducts');
  const router = useRouter();

  const [step, setStep] = useState<Step>('pick-bg');
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [obj, setObj] = useState<PlacedObject | null>(null);
  const [initialObj, setInitialObj] = useState<PlacedObject | null>(null);
  const [history, setHistory] = useState<PlacedObject[]>([]);
  const [showHint, setShowHint] = useState(true);
  const [recent, setRecent] = useState<StudioWorkItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [result, setResult] = useState<{ url: string; beforeUrl?: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const objImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const objRef = useRef<PlacedObject | null>(null);
  const ptrsRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<Gesture | null>(null);
  useEffect(() => { objRef.current = obj; }, [obj]);

  // Recent studio images as quick background choices
  useEffect(() => {
    let cancelled = false;
    fetch('/api/studio/my-work?limit=6&type=image')
      .then((r) => (r.ok ? r.json() as Promise<StudioWorkPage> : { items: [], nextCursor: null }))
      .then((data) => { if (!cancelled) setRecent((data.items ?? []).filter((i) => i.url !== cutoutUrl)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cutoutUrl]);

  // Revoke the local "before" preview when it is replaced
  useEffect(() => {
    const before = result?.beforeUrl;
    return () => { if (before) URL.revokeObjectURL(before); };
  }, [result]);

  // ── Drawing ───────────────────────────────────────────────────────────────

  const draw = useCallback((withOutline: boolean) => {
    const canvas = canvasRef.current;
    const bg = bgImgRef.current;
    const o = objRef.current;
    if (!canvas || !bg || !o) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, bg, [o], objImgsRef.current);
    if (withOutline) {
      const k = canvasScale(canvas);
      const ow = o.scale * o.naturalWidth;
      const oh = o.scale * o.naturalHeight;
      ctx.save();
      ctx.translate(o.x * canvas.width, o.y * canvas.height);
      ctx.rotate(o.rotation);
      ctx.strokeStyle = 'rgba(34,197,94,0.9)';
      ctx.lineWidth = 2 * k;
      ctx.setLineDash([8 * k, 6 * k]);
      ctx.strokeRect(-ow / 2, -oh / 2, ow, oh);
      ctx.restore();

      // Corner handles follow the rotated box
      const b = getObjBounds(o, canvas.width, canvas.height, 0);
      for (const c of [b.tl, b.tr, b.bl, b.br]) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, MOBILE_HANDLE_RADIUS * k, 0, Math.PI * 2);
        ctx.fillStyle = '#16a34a';
        ctx.fill();
        ctx.lineWidth = 2 * k;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
  }, []);

  useEffect(() => {
    if (step === 'edit') draw(true);
  }, [obj, step, canvasSize, draw]);

  // ── Background chosen → load both images, centre the product ─────────────

  const chooseBackground = useCallback(async (url: string) => {
    if (!cutoutUrl) return;
    setBusy(true);
    setError(null);
    try {
      // Same-origin proxy: a CDN without CORS headers would taint the canvas and break export
      const [bg, cut] = await Promise.all([loadImg(proxyUrl(url)), loadImg(proxyUrl(cutoutUrl))]);
      const { w, h } = canvasSizeFor(bg.naturalWidth, bg.naturalHeight, CANVAS_MAX);
      const placed: PlacedObject = {
        id: 'cutout',
        src: cutoutUrl,
        x: 0.5,
        y: 0.55,
        scale: fitScale(cut.naturalWidth, cut.naturalHeight, w, h, 0.45),
        rotation: 0,
        naturalWidth: cut.naturalWidth,
        naturalHeight: cut.naturalHeight,
      };
      bgImgRef.current = bg;
      objImgsRef.current.set(placed.id, cut);
      setBgUrl(url);
      setCanvasSize({ w, h });
      setObj(placed);
      setInitialObj(placed);
      setHistory([]);
      setShowHint(true);
      setStep('edit');
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }, [cutoutUrl, t]);

  // ── History ─────────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    const current = objRef.current;
    if (current) setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), current]);
  }, []);

  function undo() {
    if (history.length === 0) return;
    setObj(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function reset() {
    if (!initialObj) return;
    pushHistory();
    setObj(initialObj);
  }

  // ── Touch / pointer gestures ────────────────────────────────────────────────

  /** (Re)start a gesture from the current pointers and product state. */
  function beginGesture(checkpointed: boolean) {
    const o = objRef.current;
    if (!o) return;
    const pts = Array.from(ptrsRef.current.values());
    gestureRef.current = pts.length >= 2
      ? { checkpointed, start: o, startA: pts[0], startB: pts[1] }
      : { checkpointed, start: o, startPtr: pts[0] };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const canvas = canvasRef.current;
    const o = objRef.current;

    // One finger on a corner handle → proportional resize anchored at the opposite corner.
    // Handles are checked before the body (they overlap its edges).
    if (ptrsRef.current.size === 1 && canvas && o) {
      const pt = toCanvasPoint(canvas, e.clientX, e.clientY);
      const hitR = MOBILE_HANDLE_HIT_RADIUS * canvasScale(canvas);
      const b = getObjBounds(o, canvas.width, canvas.height, 0);
      const corners: [Point, Point][] = [[b.tl, b.br], [b.tr, b.bl], [b.bl, b.tr], [b.br, b.tl]];
      const hit = corners.find(([c]) => ptDist(pt.x, pt.y, c.x, c.y) <= hitR);
      if (hit) {
        const [corner, anchor] = hit;
        gestureRef.current = {
          checkpointed: false,
          start: o,
          resize: { anchor, startDist: Math.max(1, ptDist(corner.x, corner.y, anchor.x, anchor.y)) },
        };
        return;
      }
    }

    // A second finger continues the same gesture (one undo step for the whole touch)
    beginGesture(ptrsRef.current.size > 1 && (gestureRef.current?.checkpointed ?? false));
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ptrsRef.current.has(e.pointerId)) return;
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas || !initialObj) return;

    const rect = canvas.getBoundingClientRect();
    const pts = Array.from(ptrsRef.current.values());
    let next: PlacedObject;

    if (g.resize && pts.length === 1) {
      const { anchor, startDist } = g.resize;
      const pt = toCanvasPoint(canvas, e.clientX, e.clientY);
      const scale = clamp(
        g.start.scale * (ptDist(pt.x, pt.y, anchor.x, anchor.y) / startDist),
        initialObj.scale * MIN_SCALE_FACTOR,
        initialObj.scale * MAX_SCALE_FACTOR,
      );
      // Centre slides along the anchor→corner diagonal so the anchor corner stays fixed
      const r = scale / g.start.scale;
      const cx = anchor.x + (g.start.x * canvas.width - anchor.x) * r;
      const cy = anchor.y + (g.start.y * canvas.height - anchor.y) * r;
      next = { ...g.start, scale, x: cx / canvas.width, y: cy / canvas.height };
    } else if (pts.length >= 2 && g.startA && g.startB) {
      const { scaleRatio, angleDelta } = twoFingerDelta(g.startA, g.startB, pts[0], pts[1]);
      // Midpoint shift moves the product too, so a two-finger gesture feels like holding it
      const midDx = (pts[0].x + pts[1].x - g.startA.x - g.startB.x) / 2;
      const midDy = (pts[0].y + pts[1].y - g.startA.y - g.startB.y) / 2;
      next = {
        ...g.start,
        scale: clamp(g.start.scale * scaleRatio, initialObj.scale * MIN_SCALE_FACTOR, initialObj.scale * MAX_SCALE_FACTOR),
        rotation: g.start.rotation + angleDelta,
        x: clamp(g.start.x + midDx / rect.width, 0, 1),
        y: clamp(g.start.y + midDy / rect.height, 0, 1),
      };
    } else if (g.startPtr) {
      const dx = e.clientX - g.startPtr.x;
      const dy = e.clientY - g.startPtr.y;
      if (dx === 0 && dy === 0) return;
      next = {
        ...g.start,
        x: clamp(g.start.x + dx / rect.width, 0, 1),
        y: clamp(g.start.y + dy / rect.height, 0, 1),
      };
    } else {
      return;
    }

    if (!g.checkpointed) {
      pushHistory();
      g.checkpointed = true;
      setShowHint(false);
    }
    setObj(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size === 0) gestureRef.current = null;
    // 2 → 1 finger: restart from the current state so the product doesn't jump
    else beginGesture(gestureRef.current?.checkpointed ?? false);
  }

  // ── Output ──────────────────────────────────────────────────────────────────

  async function renderComposite(): Promise<Blob> {
    draw(false);
    try {
      return await canvasToBlob(canvasRef.current!);
    } finally {
      draw(true);
    }
  }

  async function saveAsIs() {
    setBusy(true);
    setError(null);
    try {
      const url = await saveComposite(await renderComposite());
      setResult({ url });
      setStep('result');
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  async function blend() {
    const canvas = canvasRef.current;
    const o = objRef.current;
    if (!canvas || !o) return;
    setError(null);
    setNoCredits(false);
    let composite: Blob;
    let mask: Blob;
    try {
      composite = await renderComposite();
      mask = await canvasToBlob(generateEdgeMask(canvas.width, canvas.height, [o], objImgsRef.current));
    } catch {
      setError(t('failed'));
      return;
    }
    setStep('processing');
    try {
      const url = await requestAiBlend(composite, mask);
      notifyCreditsChanged();
      setResult({ url, beforeUrl: URL.createObjectURL(composite) });
      setStep('result');
    } catch (err) {
      if (err instanceof BlendError && (err.status === 402 || err.status === 403)) setNoCredits(true);
      else setError(t('failed'));
      setStep('edit');
    }
  }

  // Improve (free sharp pass + optional AI Style) on the finished result
  async function handleImproved(url: string, source: 'enhanced' | 'ai') {
    const before = result?.url;
    if (!before) return;
    setStep('processing');
    try {
      // AI Style results are recorded by /api/studio/edit (with sourceUrl); the free pass
      // isn't, so save it as a place-products result linked to the composite it came from
      const finalUrl = source === 'enhanced' ? await saveComposite(await fileFromUrl(url, 'improved'), before) : url;
      if (source === 'ai') notifyCreditsChanged();
      setResult({ url: finalUrl, beforeUrl: before });
    } catch {
      setError(t('failed'));
    }
    setStep('result');
  }

  async function handleShare() {
    if (!result) return;
    setSharing(true);
    await shareImage(result.url, t('title'));
    setSharing(false);
  }

  function handleBack() {
    if (step === 'result') setStep('edit');
    else if (step === 'edit') setStep('pick-bg');
    else router.back();
  }

  // ── UI ──────────────────────────────────────────────────────────────────────


  const header = (title: string) => (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <button
        onClick={handleBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
        aria-label={t('back')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="text-base font-semibold text-white">{title}</span>
    </div>
  );

  if (!cutoutUrl) {
    return (
      <div className="flex flex-col pb-8">
        {header(t('title'))}
        <div className="px-4 pt-6 text-center">
          <p className="text-sm text-gray-400">{t('noCutout')}</p>
          <Link
            href="/studio/m/remove-bg"
            className="mt-4 inline-block rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('noCutoutCta')}
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'pick-bg') {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('title'))}
        <div className="px-4">
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cutoutUrl} alt="" className="h-14 w-14 rounded-lg object-contain" />
            <p className="text-sm text-gray-300">{t('pickBackground')}</p>
          </div>

          {busy ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
            </div>
          ) : (
            <>
              <MobileMediaPicker onImageSelected={(url) => void chooseBackground(url)} currentImage={undefined} onClear={() => {}} />
              {recent.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('recentImages')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {recent.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void chooseBackground(item.url)}
                        className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] active:scale-[0.97]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  if (step === 'improve' && result) {
    return (
      <ImproveBottomSheet
        imageUrl={result.url}
        // Composites need light/shadows matched between product and scene
        defaultPreset="studio_light"
        onDone={(url, source) => void handleImproved(url, source)}
        onCancel={() => setStep('result')}
      />
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
        <p className="text-sm text-gray-300">{t('blending')}</p>
        <p className="text-xs text-gray-500">{t('blendingHint')}</p>
      </div>
    );
  }

  if (step === 'result' && result) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('result'))}
        <div className="px-4">
          {result.beforeUrl ? (
            <BeforeAfterSlider beforeUrl={result.beforeUrl} afterUrl={result.url} beforeLabel={t('before')} afterLabel={t('after')} />
          ) : (
            <div className="flex justify-center rounded-xl bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="" className="max-h-[60vh] max-w-full rounded-xl object-contain" />
            </div>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => downloadImage(result.url)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            💾 {t('save')}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            📤 {t('share')}
          </button>
        </div>
        <div className="mt-3 px-4">
          <button
            onClick={() => router.push(`/studio/m/create?ref=${encodeURIComponent(result.url)}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            🎨 {t('usePromo')}
          </button>
        </div>
        <div className="mt-3 px-4">
          <button
            onClick={() => setStep('improve')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 py-3.5 text-sm font-semibold text-purple-200 active:bg-purple-500/20"
          >
            ✨ {t('improve')}
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <button onClick={() => setStep('edit')} className="text-sm text-gray-400 active:text-white">
            ↩ {t('keepEditing')}
          </button>
        </div>
      </div>
    );
  }

  // step === 'edit'
  return (
    <div className="flex flex-col pb-40" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {header(t('title'))}
      <div className="px-4">
        {canvasSize && bgUrl && (
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="mx-auto block max-h-[60vh] max-w-full rounded-xl"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
        {showHint && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {t('dragHint')} · {t('pinchHint')}
          </p>
        )}
        <div className="mt-3 flex justify-center gap-3">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="min-h-11 rounded-full bg-white/[0.06] px-5 text-sm text-gray-300 active:bg-white/[0.12] disabled:opacity-30"
          >
            ↩ {t('undo')}
          </button>
          <button
            onClick={reset}
            className="min-h-11 rounded-full bg-white/[0.06] px-5 text-sm text-gray-300 active:bg-white/[0.12]"
          >
            ↻ {t('reset')}
          </button>
        </div>
        {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
        {noCredits && (
          <p className="mt-3 text-center text-sm text-red-400">
            {t('noCredits')}{' '}
            <Link href="/studio/pricing" className="underline">{t('getCredits')}</Link>
          </p>
        )}
      </div>

      <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
        <div className="mx-auto max-w-lg space-y-2">
          <button
            onClick={() => void blend()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            ✨ {t('blend', { count: CREDIT_COSTS.aiBlend })}
          </button>
          <button
            onClick={() => void saveAsIs()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-white active:bg-white/[0.08] disabled:opacity-60"
          >
            {busy ? t('saving') : t('saveAsIs')}
          </button>
        </div>
      </div>
    </div>
  );
}
