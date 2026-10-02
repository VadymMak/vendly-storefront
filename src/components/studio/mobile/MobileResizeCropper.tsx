'use client';

import { useState, useEffect, useRef, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { proxyUrl } from '@/lib/studio/mobile/share';
import { PLATFORM_IMAGE_PRESETS } from '@/lib/studio/constants';
import type { CropRect } from '@/lib/types';

interface Props {
  imageUrl: string;
  currentPresetId: string;
  onDone: (croppedBlobUrl: string, newPresetId: string) => void;
  onCancel: () => void;
}

// Preview canvas resolution cap — enough for a sharp phone preview, cheap to redraw while dragging
const PREVIEW_MAX_SIDE = 1200;

function calculateCrop(imgW: number, imgH: number, targetRatio: string): CropRect {
  const [tw, th] = targetRatio.split(':').map(Number);
  const targetAspect = tw / th;
  const imgAspect = imgW / imgH;

  if (imgAspect > targetAspect) {
    // Image is wider — crop sides
    const cropW = imgH * targetAspect;
    return { x: (imgW - cropW) / 2, y: 0, w: cropW, h: imgH };
  }
  // Image is taller — crop top/bottom
  const cropH = imgW / targetAspect;
  return { x: 0, y: (imgH - cropH) / 2, w: imgW, h: cropH };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function MobileResizeCropper({ imageUrl, currentPresetId, onDone, onCancel }: Props) {
  const t = useTranslations('mobile.resize');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [presetId, setPresetId] = useState(currentPresetId);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; startCrop: CropRect } | null>(null);

  const preset = PLATFORM_IMAGE_PRESETS.find((p) => p.id === presetId) ?? PLATFORM_IMAGE_PRESETS[0];

  // crossOrigin + proxy so the canvas stays untainted and toBlob works
  useEffect(() => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setLoadError(true);
    el.src = proxyUrl(imageUrl);
    return () => { el.onload = null; el.onerror = null; };
  }, [imageUrl]);

  // Re-center the crop whenever the image arrives or the target format changes
  useEffect(() => {
    if (!img) return;
    setCrop(calculateCrop(img.naturalWidth, img.naturalHeight, preset.aspect_ratio));
  }, [img, preset.aspect_ratio]);

  // Draw preview: full image, darkened outside the crop, thin frame + thirds grid inside
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img || !crop) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = canvas.width / img.naturalWidth;
    const cx = crop.x * s, cy = crop.y * s, cw = crop.w * s, ch = crop.h * s;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, cy);
    ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);

    const line = Math.max(1, canvas.width / 400);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = line;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(cx + (cw * i) / 3, cy);
      ctx.lineTo(cx + (cw * i) / 3, cy + ch);
      ctx.moveTo(cx, cy + (ch * i) / 3);
      ctx.lineTo(cx + cw, cy + (ch * i) / 3);
    }
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = line * 2;
    ctx.strokeRect(cx + line, cy + line, cw - line * 2, ch - line * 2);
  }, [img, crop]);

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!crop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startCrop: crop };
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || !img) return;
    // Screen px → source px
    const scale = img.naturalWidth / e.currentTarget.getBoundingClientRect().width;
    const { startCrop } = d;
    setCrop({
      ...startCrop,
      x: clamp(startCrop.x + (e.clientX - d.startX) * scale, 0, img.naturalWidth - startCrop.w),
      y: clamp(startCrop.y + (e.clientY - d.startY) * scale, 0, img.naturalHeight - startCrop.h),
    });
  }

  function handlePointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }

  async function handleApply() {
    if (!img || !crop) return;
    setApplying(true);
    setApplyError(false);
    try {
      const out = document.createElement('canvas');
      out.width = preset.target_width;
      out.height = preset.target_height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/jpeg', 0.92);
      });

      // Parent (MobileResultScreen) owns this URL and revokes it when replaced / unmounted
      onDone(URL.createObjectURL(blob), preset.id);
    } catch (err) {
      console.error('[resize crop]', err);
      setApplyError(true);
      setApplying(false);
    }
  }

  const fit = img ? Math.min(1, PREVIEW_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)) : 1;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] pb-40" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={onCancel}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400 active:text-white"
          aria-label={t('cancel')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="flex-1 text-base font-semibold text-white">{t('title')}</span>
        {/* Always-visible Apply — the bottom one can sit low on short screens */}
        <button
          onClick={handleApply}
          disabled={!crop || applying}
          className="min-h-11 rounded-full bg-green-600 px-5 text-sm font-semibold text-white active:bg-green-700 disabled:bg-green-900 disabled:text-white/40"
        >
          {applying ? t('applying') : t('apply')}
        </button>
      </div>

      {/* Preview */}
      <div className="flex min-h-[30vh] items-center justify-center px-4">
        {loadError ? (
          <p role="alert" className="text-sm text-red-400">{t('loadFailed')}</p>
        ) : img ? (
          <canvas
            ref={canvasRef}
            width={Math.round(img.naturalWidth * fit)}
            height={Math.round(img.naturalHeight * fit)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="max-h-[50vh] max-w-full touch-none cursor-move select-none rounded-xl"
          />
        ) : (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
        )}
      </div>

      {img && !loadError && (
        <p className="mt-2 px-4 text-center text-xs text-gray-500">{t('dragHint')}</p>
      )}

      {/* Format chips */}
      <div className="mt-4 shrink-0">
        <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wide text-gray-500">
          {t('currentFormat')}: <span className="text-gray-300">{preset.label} · {preset.subtitle}</span>
        </p>
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {PLATFORM_IMAGE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              aria-pressed={p.id === presetId}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap ${
                p.id === presetId
                  ? 'border-green-500 bg-green-600/20 text-white'
                  : 'border-white/10 bg-white/[0.04] text-gray-300 active:bg-white/[0.08]'
              }`}
            >
              <span aria-hidden="true">{p.icon}</span>
              {p.label}
              <span className="text-xs text-gray-500">{p.aspect_ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {applyError && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {t('applyFailed')}
        </p>
      )}

      {/* Apply — fixed above the bottom nav, like the other mobile CTAs */}
      <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
        <div className="mx-auto max-w-lg">
          <button
            onClick={handleApply}
            disabled={!crop || applying}
            className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700 disabled:bg-green-900 disabled:text-white/40"
          >
            {applying ? t('applying') : t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
