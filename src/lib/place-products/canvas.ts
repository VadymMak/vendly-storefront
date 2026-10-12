// Browser-side rendering + API helpers for Place Products (desktop editor + mobile page).
import type { PlacedObject } from '@/lib/types';

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Background cover-fit + objects (back → front) with a soft drop shadow. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement,
  objects: PlacedObject[],
  objImgs: Map<string, HTMLImageElement>,
): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const bgR = bg.naturalWidth / bg.naturalHeight;
  const cnR = cw / ch;
  let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;
  if (bgR > cnR) {
    sw = bg.naturalHeight * cnR;
    sx = (bg.naturalWidth - sw) / 2;
  } else {
    sh = bg.naturalWidth / cnR;
    sy = (bg.naturalHeight - sh) / 2;
  }
  ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, cw, ch);

  // Shadow scales with canvas size so desktop (800px) and mobile (1600px) look alike
  const k = Math.max(cw, ch) / 800;
  for (const obj of objects) {
    const img = objImgs.get(obj.id);
    if (!img) continue;
    const ow = obj.scale * obj.naturalWidth;
    const oh = obj.scale * obj.naturalHeight;
    ctx.save();
    ctx.translate(obj.x * cw, obj.y * ch);
    ctx.rotate(obj.rotation);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 20 * k;
    ctx.shadowOffsetY = 6 * k;
    ctx.drawImage(img, -ow / 2, -oh / 2, ow, oh);
    ctx.restore();
  }
}

/**
 * AI Blend mask: white ring around each object's outline (dilate ~6px, erode ~2px),
 * black elsewhere — flux-fill-pro only repaints the seams.
 */
export function generateEdgeMask(
  width: number,
  height: number,
  objects: PlacedObject[],
  objImgs: Map<string, HTMLImageElement>,
): HTMLCanvasElement {
  const k = Math.max(width, height) / 800;
  const EDGE = 6 * k;
  const ERODE = 2 * k;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, width, height);

  const drawObj = (obj: PlacedObject, img: HTMLImageElement, factor: number) => {
    const hw = (obj.scale * obj.naturalWidth) / 2;
    const hh = (obj.scale * obj.naturalHeight) / 2;
    mctx.save();
    mctx.translate(obj.x * width, obj.y * height);
    mctx.rotate(obj.rotation);
    mctx.scale(factor, factor);
    mctx.drawImage(img, -hw, -hh, hw * 2, hh * 2);
    mctx.restore();
  };

  // Dilate pass: each object scaled up creates the edge zone
  mctx.globalCompositeOperation = 'source-over';
  for (const obj of objects) {
    const img = objImgs.get(obj.id);
    if (!img) continue;
    const minDim = Math.min(obj.scale * obj.naturalWidth, obj.scale * obj.naturalHeight);
    drawObj(obj, img, minDim > 0 ? 1 + (EDGE * 2) / minDim : 1);
  }

  // Erode pass: cut out the interior so only the ring stays
  mctx.globalCompositeOperation = 'destination-out';
  for (const obj of objects) {
    const img = objImgs.get(obj.id);
    if (!img) continue;
    const minDim = Math.min(obj.scale * obj.naturalWidth, obj.scale * obj.naturalHeight);
    drawObj(obj, img, minDim > 0 ? Math.max(0, 1 - (ERODE * 2) / minDim) : 1);
  }

  mctx.globalCompositeOperation = 'source-over';
  return maskCanvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/** Save a finished composite (free) — stored and listed in My Work; returns its URL. */
export async function saveComposite(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('image', blob, 'composite.png');
  const res = await fetch('/api/studio/save-composite', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Save failed');
  return ((await res.json()) as { url: string }).url;
}

export class BlendError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'BlendError';
  }
}

/** POST composite + edge mask to /api/studio/ai-blend (1 credit, listed in My Work); returns the blended URL. */
export async function requestAiBlend(composite: Blob, mask: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('composite', composite, 'composite.png');
  fd.append('mask', mask, 'mask.png');
  const res = await fetch('/api/studio/ai-blend', { method: 'POST', body: fd });
  const json = await res.json().catch(() => ({})) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new BlendError(json.error ?? 'AI Blend failed', res.status);
  return json.url;
}
