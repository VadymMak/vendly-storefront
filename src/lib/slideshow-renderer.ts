/**
 * Client-side slideshow video renderer.
 * Uses Canvas + WebCodecs (VideoEncoder + mp4-muxer) — zero server CPU, runs entirely in browser.
 * Falls back to Canvas + MediaRecorder when WebCodecs is not available.
 *
 * Video items: seeked per-frame via WebCodecs VideoEncoder with explicit microsecond timestamps.
 * Falls back to MediaRecorder + per-frame seek if WebCodecs unavailable.
 * Image items: drawn with Ken Burns camera motion at frameInterval pace.
 *
 * Two-pass when audio is present:
 *   Pass 1 — render video-only (canvas.captureStream, no AudioContext).
 *             Audio starts at recording start, not after encoding delay.
 *   Pass 2 — play Pass-1 video + mix audio in real-time → final blob.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out';

export type VideoStyle = 'none' | 'golden-hour' | 'cinematic' | 'vintage' | 'cool-tone' | 'bw';

export type CameraMotion =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'diagonal-zoom';

export interface SlideshowItem {
  type: 'image' | 'video' | 'color-card';
  element?: HTMLImageElement | HTMLVideoElement; // undefined for color-card
  duration: number;
  motion?: CameraMotion;       // images only
  bgColor?: string;             // color-card only: CSS color string e.g. '#0a0a0a'
  cardOverlays?: TextOverlay[];  // per-scene text overlays (available on all item types)
  style?: VideoStyle;            // per-scene override; if omitted → SlideshowConfig.style
}

export interface WatermarkConfig {
  image: HTMLImageElement;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;    // 0.0 to 1.0, default 0.8
  sizeRatio: number;  // fraction of canvas width, default 0.12
}

export interface SlideshowConfig {
  items: SlideshowItem[];
  transitionDuration: number;
  transitionType: TransitionType;
  outputSize: { width: number; height: number };
  fps: number;
  audioFile?: File;   // voiceover -- full volume, no loop
  musicFile?: File;   // background music -- low volume, looping
  audioClips?: Array<{
    sourceUrl: string;
    startTime: number;
    duration: number;
    volume?: number;
    fadeInDuration?: number;
    fadeOutDuration?: number;
  }>;
  grain?: number;     // 0-1 film grain intensity; 0 = off (default); 0.2 = cinematic; 0.35 = vintage
  style?: VideoStyle; // default: 'none'
  textOverlays?: TextOverlay[];
  watermark?: WatermarkConfig;
}

export interface RenderProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  phase: 'rendering' | 'audio';
}

export type OnProgress = (progress: RenderProgress) => void;

export interface TextOverlay {
  text: string;
  position: 'top' | 'center' | 'bottom';
  style: 'brand' | 'subtitle' | 'cta' | 'bar' | 'custom';
  from?: number;
  to?: number;

  // Custom styling (used when style === 'custom' or 'bar')
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  backgroundColor?: string;
  barColor?: string;
  barHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  paddingX?: number;
  paddingY?: number;
  lineTwo?: string;
  animation?: 'none' | 'fade-in' | 'slide-left' | 'slide-up' | 'slide-right' | 'slide-down' | 'typewriter' | 'bounce' | 'scale-up' | 'blur-in';
  animationDuration?: number;
  animationMode?: 'per-block' | 'per-word' | 'per-character';
  animationDelay?: number;
  exitAnimation?: 'none' | 'fade-out' | 'slide-out-left' | 'slide-out-right' | 'scale-down';
  exitAnimationDuration?: number;

  // Free XY positioning (percentage 0–100, relative to canvas; undefined = use position preset)
  x?: number;
  y?: number;

  // Scope
  scope?: 'global' | 'scene';
  sceneIndex?: number;

  // Extended text properties (Prompt 59)
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  bgShape?: 'none' | 'rect' | 'rounded' | 'pill';
  bgShapeColor?: string;
  bgShapeOpacity?: number;
  bgShapePadding?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  opacity?: number;

  // Resizable frame (Prompt 60)
  width?: number;    // % of canvas width (for future text-wrap)
  height?: number;   // % of canvas height
  rotation?: number; // degrees, applied in canvas renderer
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
}

// ── Camera motion ──────────────────────────────────────────────────────────────

export const DEFAULT_SEQUENCE: CameraMotion[] = [
  'zoom-in',
  'pan-right',
  'zoom-out',
  'pan-left',
  'diagonal-zoom',
  'pan-up',
  'pan-down',
];

export interface MotionPreset {
  startScale: number;
  endScale:   number;
  startPanX:  number;
  startPanY:  number;
  endPanX:    number;
  endPanY:    number;
}

export const MOTION_PRESETS: Record<CameraMotion, MotionPreset> = {
  'zoom-in':       { startScale: 1.00, endScale: 1.15, startPanX:  0.00, startPanY:  0.00, endPanX:  0.04, endPanY: -0.04 },
  'zoom-out':      { startScale: 1.18, endScale: 1.00, startPanX:  0.04, startPanY:  0.04, endPanX:  0.00, endPanY:  0.00 },
  'pan-right':     { startScale: 1.10, endScale: 1.10, startPanX: -0.15, startPanY:  0.00, endPanX:  0.15, endPanY:  0.00 },
  'pan-left':      { startScale: 1.10, endScale: 1.10, startPanX:  0.15, startPanY:  0.00, endPanX: -0.15, endPanY:  0.00 },
  'pan-up':        { startScale: 1.10, endScale: 1.10, startPanX:  0.00, startPanY:  0.12, endPanX:  0.00, endPanY: -0.12 },
  'pan-down':      { startScale: 1.10, endScale: 1.10, startPanX:  0.00, startPanY: -0.12, endPanX:  0.00, endPanY:  0.12 },
  'diagonal-zoom': { startScale: 1.00, endScale: 1.12, startPanX: -0.08, startPanY: -0.06, endPanX:  0.08, endPanY:  0.06 },
};

// ── Visual styles (canvas filters + overlays) ─────────────────────────────────

interface StylePreset {
  filter: string;
  overlay: { color: string; blend: string } | null;
  letterbox: boolean;
  vignette?: boolean;
}

const STYLE_PRESETS: Record<VideoStyle, StylePreset> = {
  'none':        { filter: 'none', overlay: null, letterbox: false },
  'golden-hour': { filter: 'brightness(1.08) contrast(1.05) saturate(1.3) sepia(0.15)', overlay: { color: 'rgba(255, 165, 0, 0.08)', blend: 'overlay' }, letterbox: false },
  'cinematic':   { filter: 'contrast(1.15) saturate(0.9) brightness(0.95)', overlay: null, letterbox: true, vignette: true },
  'vintage':     { filter: 'sepia(0.35) contrast(1.1) brightness(1.05) saturate(0.8)', overlay: { color: 'rgba(255, 240, 200, 0.1)', blend: 'overlay' }, letterbox: false },
  'cool-tone':   { filter: 'saturate(0.85) brightness(1.05) contrast(1.05)', overlay: { color: 'rgba(0, 100, 255, 0.06)', blend: 'overlay' }, letterbox: false },
  'bw':          { filter: 'grayscale(1) contrast(1.15) brightness(1.05)', overlay: null, letterbox: false },
};

function applyStyle(ctx: CanvasRenderingContext2D, style: VideoStyle, W: number, H: number): void {
  const preset = STYLE_PRESETS[style];
  if (preset.overlay) {
    ctx.globalCompositeOperation = preset.overlay.blend as GlobalCompositeOperation;
    ctx.fillStyle = preset.overlay.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (preset.vignette) {
    const gradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
  if (preset.letterbox) {
    const barH = H * 0.08;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);
  }
}

// ── Easing ────────────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ── Crop / draw helpers ───────────────────────────────────────────────────────

function getCropRect(
  motion: CameraMotion,
  eased: number,
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const p     = MOTION_PRESETS[motion];
  const scale = p.startScale + (p.endScale - p.startScale) * eased;
  const panX  = p.startPanX + (p.endPanX - p.startPanX) * eased;
  const panY  = p.startPanY + (p.endPanY - p.startPanY) * eased;

  const canvasAspect = canvasW / canvasH;
  const imgAspect    = imgW / imgH;
  let baseW: number, baseH: number;
  if (imgAspect > canvasAspect) {
    baseH = imgH;
    baseW = imgH * canvasAspect;
  } else {
    baseW = imgW;
    baseH = imgW / canvasAspect;
  }

  const sw = baseW / scale;
  const sh = baseH / scale;
  const sx = (imgW - sw) * (0.5 + panX);
  const sy = (imgH - sh) * (0.5 + panY);
  return { sx, sy, sw, sh };
}

function getMotionCrop(
  img: HTMLImageElement,
  motion: CameraMotion | null | undefined,
  rawProgress: number,
  W: number, H: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!motion) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw    = W / scale;
    const sh    = H / scale;
    return { sx: (img.naturalWidth - sw) / 2, sy: (img.naturalHeight - sh) / 2, sw, sh };
  }
  return getCropRect(motion, easeInOutCubic(rawProgress), img.naturalWidth, img.naturalHeight, W, H);
}

// Draw item into destination rect.
// Videos are drawn from their current real-time play position — no seeking.
function drawItemAtRect(
  ctx: CanvasRenderingContext2D,
  item: SlideshowItem,
  canvasW: number, canvasH: number,
  rawProgress: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (item.type === 'color-card') {
    ctx.fillStyle = item.bgColor ?? '#0a0a0a';
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }
  if (item.type === 'video') {
    const video = item.element as HTMLVideoElement;
    const vW    = video.videoWidth;
    const vH    = video.videoHeight;
    if (vW === 0 || vH === 0) return;
    const videoAspect  = vW / vH;
    const canvasAspect = canvasW / canvasH;
    let sx: number, sy: number, sw: number, sh: number;
    if (videoAspect > canvasAspect) {
      sh = vH; sw = sh * canvasAspect; sx = (vW - sw) / 2; sy = 0;
    } else {
      sw = vW; sh = sw / canvasAspect; sx = 0; sy = (vH - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    const img            = item.element as HTMLImageElement;
    const { sx, sy, sw, sh } = getMotionCrop(img, item.motion ?? null, rawProgress, canvasW, canvasH);
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

// Used only in the preload phase — not during the rendering loop.
async function seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.01) { resolve(); return; }
    let done = false;
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    const onSeeked = () => { if (done) return; done = true; cleanup(); resolve(); };
    const onError  = () => { if (done) return; done = true; cleanup(); reject(new Error('Video seek failed')); };
    // If seeked doesn't fire within 2s, proceed with whatever frame is ready
    const timer = setTimeout(() => { if (done) return; done = true; cleanup(); resolve(); }, 2000);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

/**
 * Wait for the browser's video decoder to have the current frame ready.
 * Uses createImageBitmap(video) which forces a decode and resolves once pixels
 * are available. Works on detached (not-in-DOM) video elements — unlike
 * requestVideoFrameCallback which requires compositor attachment.
 */
async function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  try {
    const bmp = await createImageBitmap(video);
    bmp.close();
  } catch {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

// ── Frame state ───────────────────────────────────────────────────────────────
//
// Overlapping model with variable per-item durations:
//   step[i]      = durations[i] - transitionDuration
//   startTime[i] = sum(step[0..i-1])
//   transition i→i+1 occupies [startTimes[i+1], startTimes[i] + durations[i])
//   totalDuration = sum(durations) - (n-1) * transitionDuration

type FrameState =
  | { kind: 'steady';     imageIndex: number;                  progress: number }
  | { kind: 'transition'; fromIndex:  number; toIndex: number; progress: number };

function getFrameState(
  frame: number,
  fps: number,
  startTimes: number[],
  durations: number[],
  transitionDuration: number,
): FrameState {
  const t = frame / fps;
  const n = durations.length;

  for (let i = 0; i < n - 1; i++) {
    const transStart = startTimes[i + 1];
    const transEnd   = startTimes[i] + durations[i];
    if (t >= transStart && t < transEnd) {
      return { kind: 'transition', fromIndex: i, toIndex: i + 1, progress: (t - transStart) / transitionDuration };
    }
  }

  for (let i = 0; i < n; i++) {
    const imgStart = startTimes[i];
    const imgEnd   = imgStart + durations[i];
    if (t >= imgStart && t < imgEnd) {
      return { kind: 'steady', imageIndex: i, progress: (t - imgStart) / durations[i] };
    }
  }

  return { kind: 'steady', imageIndex: n - 1, progress: 1 };
}

// ── Frame drawing (synchronous — videos drawn from current play position) ─────

// Audio is now in Pass 2 (real-time, no drift), so slow filter rendering in Pass 1
// no longer breaks audio sync. Apply cssFilter to all items including video.
function itemFilter(item: SlideshowItem, globalCssFilter: string): string {
  if (item.style && item.style !== 'none') {
    return STYLE_PRESETS[item.style].filter;
  }
  return globalCssFilter;
}

function drawTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  stroke = false,
): void {
  let totalWidth = 0;
  for (const ch of text) totalWidth += ctx.measureText(ch).width;
  totalWidth += spacing * Math.max(0, text.length - 1);

  let cx = x - totalWidth / 2;
  for (const ch of text) {
    const charW = ctx.measureText(ch).width;
    const drawX = cx + charW / 2;
    ctx.textAlign = 'center';
    if (stroke) ctx.strokeText(ch, drawX, y);
    else ctx.fillText(ch, drawX, y);
    cx += charW + spacing;
  }
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { const u = t - 1.5 / 2.75;   return 7.5625 * u * u + 0.75; }
  if (t < 2.5 / 2.75) { const u = t - 2.25 / 2.75; return 7.5625 * u * u + 0.9375; }
  const u = t - 2.625 / 2.75; return 7.5625 * u * u + 0.984375;
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  W: number,
  H: number,
  currentTime?: number,
): void {
  ctx.save();
  ctx.shadowBlur = 0;

  // ── Animation state ────────────────────────────────────────────────────────
  const anim     = overlay.animation     ?? 'none';
  const exitAnim = overlay.exitAnimation ?? 'none';
  let entryT = 1;
  let exitT  = 0;

  if (currentTime !== undefined) {
    const animStart  = (overlay.from ?? 0) + (overlay.animationDelay ?? 0);
    const animDur    = overlay.animationDuration ?? 0.5;
    const elapsed    = currentTime - animStart;
    const rawEntry   = Math.max(0, Math.min(1, elapsed / Math.max(0.001, animDur)));
    entryT = anim === 'bounce' ? easeOutBounce(rawEntry) : easeOut(rawEntry);

    if (exitAnim !== 'none' && overlay.to !== undefined) {
      const exitDur      = overlay.exitAnimationDuration ?? 0.3;
      const timeUntilEnd = overlay.to - currentTime;
      exitT = Math.max(0, Math.min(1, 1 - timeUntilEnd / exitDur));
    }
  }

  // Entry animation (exclude typewriter — handled per-text below)
  if (anim !== 'none' && anim !== 'typewriter') {
    switch (anim) {
      case 'fade-in':     ctx.globalAlpha *= entryT; break;
      case 'slide-left':  ctx.translate((1 - entryT) * W * 0.25, 0); break;
      case 'slide-right': ctx.translate(-(1 - entryT) * W * 0.25, 0); break;
      case 'slide-up':    ctx.translate(0, (1 - entryT) * H * 0.08); break;
      case 'slide-down':  ctx.translate(0, -(1 - entryT) * H * 0.08); break;
      case 'scale-up': {
        const s = Math.max(0.001, entryT);
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        break;
      }
      case 'bounce':
        ctx.translate(0, (1 - entryT) * H * 0.1);
        break;
      case 'blur-in': {
        const blurPx = Math.round((1 - entryT) * 20);
        if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
        ctx.globalAlpha *= Math.max(0.05, entryT);
        break;
      }
    }
  }

  // Exit animation
  if (exitAnim !== 'none' && exitT > 0) {
    switch (exitAnim) {
      case 'fade-out':        ctx.globalAlpha *= (1 - exitT); break;
      case 'slide-out-left':  ctx.translate(-exitT * W * 0.25, 0); break;
      case 'slide-out-right': ctx.translate(exitT * W * 0.25, 0); break;
      case 'scale-down': {
        const s = Math.max(0.001, 1 - exitT);
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        break;
      }
    }
  }

  switch (overlay.style) {
    case 'brand': {
      const fontSize = overlay.fontSize
        ? Math.round(overlay.fontSize * W / 1080)
        : Math.round(W * 0.055);
      const fontFamily = overlay.fontFamily
        ? `'${overlay.fontFamily}', serif`
        : "Georgia, 'Times New Roman', serif";
      const fontWeight = overlay.fontWeight ?? 'bold';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const posX = overlay.x !== undefined ? (overlay.x / 100) * W : W / 2;
      const posY = overlay.y !== undefined
        ? (overlay.y / 100) * H
        : overlay.position === 'top' ? H * 0.14 : overlay.position === 'bottom' ? H * 0.86 : H * 0.5;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = overlay.color ?? '#FFFFFF';
      ctx.fillText(overlay.text, posX, posY);
      const metrics = ctx.measureText(overlay.text);
      const lineW = Math.min(metrics.width * 0.4, W * 0.25);
      ctx.shadowBlur = 0;
      ctx.fillStyle = overlay.color ? `${overlay.color}99` : 'rgba(255,255,255,0.6)';
      ctx.fillRect(posX - lineW / 2, posY + fontSize * 0.7, lineW, 1.5);
      break;
    }

    case 'subtitle': {
      const fontSize = overlay.fontSize
        ? Math.round(overlay.fontSize * W / 1080)
        : Math.round(W * 0.032);
      const fontFamily = overlay.fontFamily
        ? `'${overlay.fontFamily}', sans-serif`
        : 'Arial, Helvetica, sans-serif';
      const fontWeight = overlay.fontWeight ?? 'normal';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const posX = overlay.x !== undefined ? (overlay.x / 100) * W : W / 2;
      const posY = overlay.y !== undefined
        ? (overlay.y / 100) * H
        : overlay.position === 'top' ? H * 0.12 : overlay.position === 'center' ? H * 0.55 : H * 0.91;
      const metrics = ctx.measureText(overlay.text);
      const padX = fontSize * 0.7;
      const padY = fontSize * 0.35;
      const bgX = posX - metrics.width / 2 - padX;
      const bgY = posY - fontSize - padY;
      const bgW = metrics.width + padX * 2;
      const bgH = fontSize + padY * 2;
      const r   = bgH / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, r);
      ctx.fill();
      ctx.fillStyle = overlay.color ?? '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(overlay.text, posX, posY);
      break;
    }

    case 'cta': {
      const fontSize = overlay.fontSize
        ? Math.round(overlay.fontSize * W / 1080)
        : Math.round(W * 0.038);
      const fontFamily = overlay.fontFamily
        ? `'${overlay.fontFamily}', sans-serif`
        : 'Arial, Helvetica, sans-serif';
      const fontWeight = overlay.fontWeight ?? 'bold';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const posX = overlay.x !== undefined ? (overlay.x / 100) * W : W / 2;
      const posY = overlay.y !== undefined
        ? (overlay.y / 100) * H
        : overlay.position === 'top' ? H * 0.12 : overlay.position === 'center' ? H * 0.5 : H * 0.87;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = overlay.color ?? '#FFD700';
      ctx.fillText(overlay.text, posX, posY);
      break;
    }

    case 'bar': {
      const barH = Math.round(H * (overlay.barHeight ?? 8) / 100);
      const barColor = overlay.barColor ?? '#E85D04';
      const padX = Math.round((overlay.paddingX ?? 20) * W / 1080);
      const barY = overlay.position === 'top' ? 0 : H - barH;
      const textColor = overlay.color ?? '#FFFFFF';
      const fontSize = overlay.fontSize
        ? Math.round(overlay.fontSize * W / 1080)
        : Math.round(W * 0.032);

      // Bar background
      ctx.fillStyle = barColor;
      ctx.fillRect(0, barY, W, barH);
      // Accent stripe at top of bar
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, barY, W, 3);

      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      const barFontFamily = overlay.fontFamily ?? 'Arial, Helvetica, sans-serif';

      if (overlay.lineTwo) {
        const smallSize = Math.round(fontSize * 0.72);
        const gapY = Math.round(H * 0.005);
        const totalTextH = fontSize + smallSize + gapY;
        const lineOneY = barY + (barH - totalTextH) / 2;

        ctx.font = `bold ${fontSize}px ${barFontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = textColor;
        ctx.fillText(overlay.text, padX, lineOneY);

        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * 0.85;
        ctx.font = `${smallSize}px ${barFontFamily}`;
        ctx.fillStyle = textColor;
        ctx.fillText(overlay.lineTwo, padX, lineOneY + fontSize + gapY);
        ctx.restore();
      } else {
        ctx.font = `bold ${fontSize}px ${barFontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(overlay.text, padX, barY + barH / 2);
      }
      break;
    }

    case 'custom': {
      const scaledSize = overlay.fontSize
        ? Math.round(overlay.fontSize * W / 1080)
        : Math.round(W * 0.04);
      const fontFamily  = overlay.fontFamily ?? 'Arial, Helvetica, sans-serif';
      const fontWeight  = overlay.fontWeight === 'normal' ? '' : 'bold';
      const align       = overlay.textAlign ?? 'center';
      const padX        = Math.round((overlay.paddingX ?? 20) * W / 1080);
      const letterSpacing = overlay.letterSpacing
        ? Math.round(overlay.letterSpacing * W / 1080)
        : 0;

      // Text transform
      let displayText = overlay.text;
      if (overlay.textTransform === 'uppercase') displayText = displayText.toUpperCase();
      else if (overlay.textTransform === 'lowercase') displayText = displayText.toLowerCase();

      // Typewriter: slice text to animation progress
      if (anim === 'typewriter') {
        displayText = displayText.slice(0, Math.floor(displayText.length * entryT));
      }

      ctx.save();

      if (overlay.opacity !== undefined && overlay.opacity < 1) {
        ctx.globalAlpha = ctx.globalAlpha * overlay.opacity;
      }

      ctx.font = `${fontWeight} ${scaledSize}px ${fontFamily}`.trim();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Position
      const posX = overlay.x !== undefined
        ? (overlay.x / 100) * W
        : align === 'left' ? padX : align === 'right' ? W - padX : W / 2;
      const posY = overlay.y !== undefined
        ? (overlay.y / 100) * H
        : overlay.position === 'top' ? H * 0.12 : overlay.position === 'center' ? H * 0.5 : H * 0.88;

      // Rotation transform around text center
      const rotDeg = overlay.rotation ?? 0;
      if (rotDeg !== 0) {
        const rad = (rotDeg * Math.PI) / 180;
        ctx.translate(posX, posY);
        ctx.rotate(rad);
        ctx.translate(-posX, -posY);
      }

      // Metrics for bg shape
      const metrics   = ctx.measureText(displayText);
      const textW     = metrics.width + letterSpacing * Math.max(0, displayText.length - 1);
      const textH     = scaledSize * (overlay.lineHeight ?? 1.2);

      // 1. Background shape
      const bgShapeColor = overlay.bgShapeColor ?? overlay.backgroundColor;
      const bgShape      = overlay.bgShape ?? (bgShapeColor ? 'rounded' : 'none');
      if (bgShape !== 'none' && bgShapeColor) {
        const pad    = overlay.bgShapePadding
          ? Math.round(overlay.bgShapePadding * W / 1080)
          : Math.round(scaledSize * 0.5);
        const shapeW = textW + pad * 2;
        const shapeH = textH + pad * 2;
        const shapeX = posX - shapeW / 2;
        const shapeY = posY - shapeH / 2;

        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * (overlay.bgShapeOpacity ?? 0.8);
        ctx.fillStyle   = bgShapeColor;
        if (bgShape === 'rect') {
          ctx.fillRect(shapeX, shapeY, shapeW, shapeH);
        } else if (bgShape === 'rounded') {
          ctx.beginPath();
          ctx.roundRect(shapeX, shapeY, shapeW, shapeH, Math.min(shapeH / 4, 12));
          ctx.fill();
        } else if (bgShape === 'pill') {
          ctx.beginPath();
          ctx.roundRect(shapeX, shapeY, shapeW, shapeH, shapeH / 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Shadow
      if (overlay.shadowColor && (overlay.shadowBlur || overlay.shadowOffsetX || overlay.shadowOffsetY)) {
        ctx.shadowColor   = overlay.shadowColor;
        ctx.shadowBlur    = overlay.shadowBlur    ? Math.round(overlay.shadowBlur    * W / 1080) : 0;
        ctx.shadowOffsetX = overlay.shadowOffsetX ? Math.round(overlay.shadowOffsetX * W / 1080) : 2;
        ctx.shadowOffsetY = overlay.shadowOffsetY ? Math.round(overlay.shadowOffsetY * W / 1080) : 2;
      }

      // 3. Per-word / per-character stagger (fade-in and slide-up only)
      const animMode = overlay.animationMode ?? 'per-block';
      const supportsStagger = anim === 'fade-in' || anim === 'slide-up';
      const useStagger = (animMode === 'per-word' || animMode === 'per-character') && supportsStagger && currentTime !== undefined;

      if (useStagger) {
        const usePerChar = animMode === 'per-character' && displayText.length <= 50;
        const units = usePerChar
          ? displayText.split('')
          : displayText.split(' ').filter(u => u.length > 0);
        const staggerDelay = usePerChar ? 0.04 : 0.08;
        const unitDur      = Math.max(0.1, (overlay.animationDuration ?? 0.5) * 0.6);
        const animStartT   = (overlay.from ?? 0) + (overlay.animationDelay ?? 0);
        const spaceW       = ctx.measureText(' ').width;

        const unitWidths = units.map(u => ctx.measureText(u).width);
        let totalW = unitWidths.reduce((s, w) => s + w, 0);
        if (usePerChar) {
          totalW += letterSpacing * Math.max(0, units.length - 1);
        } else {
          totalW += spaceW * Math.max(0, units.length - 1);
        }

        let unitX = posX - totalW / 2;
        ctx.textAlign = 'left';

        const savedAlpha = ctx.globalAlpha;
        for (let i = 0; i < units.length; i++) {
          const unitElapsed = (currentTime!) - animStartT - i * staggerDelay;
          const rawT  = Math.max(0, Math.min(1, unitElapsed / unitDur));
          const unitT = easeOut(rawT);

          ctx.globalAlpha = savedAlpha * unitT;
          ctx.save();
          if (anim === 'slide-up' && unitT < 1) {
            ctx.translate(0, (1 - unitT) * H * 0.04);
          }

          ctx.fillStyle = overlay.color ?? '#FFFFFF';
          ctx.fillText(units[i], unitX, posY);

          if (overlay.strokeColor && (overlay.strokeWidth ?? 0) > 0) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.strokeStyle  = overlay.strokeColor;
            ctx.lineWidth    = Math.round((overlay.strokeWidth ?? 1) * W / 1080);
            ctx.lineJoin     = 'round';
            ctx.strokeText(units[i], unitX, posY);
          }
          ctx.restore();

          unitX += unitWidths[i] + (usePerChar ? letterSpacing : spaceW);
        }
        ctx.globalAlpha = savedAlpha;
      } else {
        // 3b. Normal text fill
        ctx.fillStyle = overlay.color ?? '#FFFFFF';
        if (letterSpacing > 0) {
          drawTextWithSpacing(ctx, displayText, posX, posY, letterSpacing, false);
        } else {
          ctx.fillText(displayText, posX, posY);
        }

        // 4. Reset shadow before stroke
        ctx.shadowColor   = 'transparent';
        ctx.shadowBlur    = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 5. Stroke
        if (overlay.strokeColor && (overlay.strokeWidth ?? 0) > 0) {
          ctx.strokeStyle = overlay.strokeColor;
          ctx.lineWidth   = Math.round((overlay.strokeWidth ?? 1) * W / 1080);
          ctx.lineJoin    = 'round';
          if (letterSpacing > 0) {
            drawTextWithSpacing(ctx, displayText, posX, posY, letterSpacing, true);
          } else {
            ctx.strokeText(displayText, posX, posY);
          }
        }
      }

      ctx.restore();
      break;
    }
  }

  ctx.restore();
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  wm: WatermarkConfig,
  W: number,
  H: number,
): void {
  const wmW = Math.round(W * wm.sizeRatio);
  const aspect = wm.image.naturalHeight / wm.image.naturalWidth;
  const wmH = Math.round(wmW * aspect);
  const pad = Math.round(W * 0.025);

  let x: number;
  let y: number;

  if (wm.position === 'top-left') {
    x = pad;
    y = pad;
  } else if (wm.position === 'top-right') {
    x = W - wmW - pad;
    y = pad;
  } else if (wm.position === 'bottom-left') {
    x = pad;
    y = H - wmH - pad;
  } else {
    x = W - wmW - pad;
    y = H - wmH - pad;
  }

  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.drawImage(wm.image, x, y, wmW, wmH);
  ctx.restore();
}

// Renders per-frame random noise at 1/4 resolution (performance), scaled up for film grain look.
// Creating a small canvas per frame is intentional -- avoids stale grain between frames.
function applyFilmGrain(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  intensity: number,
): void {
  const GW = Math.ceil(W / 4);
  const GH = Math.ceil(H / 4);

  const gCanvas = document.createElement('canvas');
  gCanvas.width  = GW;
  gCanvas.height = GH;
  const gCtx = gCanvas.getContext('2d');
  if (!gCtx) return;

  const imageData = gCtx.createImageData(GW, GH);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v     = (Math.random() * 255) | 0;
    data[i]     = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = (Math.random() * 255 * intensity) | 0;
  }
  gCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity * 0.55;
  ctx.drawImage(gCanvas, 0, 0, W, H);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  startTimes: number[],
  frame: number,
): void {
  const { items, transitionDuration, transitionType, fps, outputSize, style = 'none' } = config;
  const W        = outputSize.width;
  const H        = outputSize.height;
  const t        = frame / fps;
  const durations = items.map((item) => item.duration);
  const cssFilter = STYLE_PRESETS[style].filter;

  ctx.globalAlpha = 1;
  ctx.fillStyle   = '#000';
  ctx.fillRect(0, 0, W, H);

  const renderOverlays = () => {
    if (!config.textOverlays?.length) return;
    for (const overlay of config.textOverlays) {
      const showFrom = overlay.from ?? 0;
      const showTo   = overlay.to   ?? Infinity;
      if (t >= showFrom && t <= showTo) {
        drawTextOverlay(ctx, overlay, W, H, t);
      }
    }
  };

  const state = getFrameState(frame, fps, startTimes, durations, transitionDuration);

  if (state.kind === 'steady') {
    const item        = items[state.imageIndex];
    const rawProgress = Math.max(0, Math.min(1, (t - startTimes[state.imageIndex]) / item.duration));
    ctx.filter = itemFilter(item, cssFilter);
    drawItemAtRect(ctx, item, W, H, rawProgress, 0, 0, W, H);
    ctx.filter = 'none';
    applyStyle(ctx, item.style ?? style, W, H);
    renderOverlays();
    if (item.cardOverlays) {
      for (const ov of item.cardOverlays) {
        const showFrom = ov.from ?? 0;
        const showTo   = ov.to   ?? Infinity;
        if (t >= showFrom && t <= showTo) {
          drawTextOverlay(ctx, ov, W, H, t);
        }
      }
    }
    if (config.watermark) drawWatermark(ctx, config.watermark, W, H);
    if (config.grain && config.grain > 0) applyFilmGrain(ctx, W, H, config.grain);
    return;
  }

  // Transition — video items are already playing via play() in the render loop
  const { fromIndex, toIndex, progress } = state;
  const fromItem  = items[fromIndex];
  const toItem    = items[toIndex];
  const fromRaw   = Math.max(0, Math.min(1, (t - startTimes[fromIndex]) / fromItem.duration));
  const toRaw     = Math.max(0, Math.min(1, (t - startTimes[toIndex])   / toItem.duration));

  switch (transitionType) {
    case 'fade': {
      ctx.globalAlpha = 1 - progress;
      ctx.filter = itemFilter(fromItem, cssFilter);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.globalAlpha = progress;
      ctx.filter = itemFilter(toItem, cssFilter);
      drawItemAtRect(ctx, toItem,   W, H, toRaw,   0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      break;
    }

    case 'slide-left': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(-progress * W, 0);
      ctx.filter = itemFilter(fromItem, cssFilter);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - progress) * W, 0);
      ctx.filter = itemFilter(toItem, cssFilter);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
      ctx.restore();
      ctx.restore();
      ctx.filter = 'none';
      break;
    }

    case 'slide-right': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(progress * W, 0);
      ctx.filter = itemFilter(fromItem, cssFilter);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - progress) * W, 0);
      ctx.filter = itemFilter(toItem, cssFilter);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
      ctx.restore();
      ctx.restore();
      ctx.filter = 'none';
      break;
    }

    case 'zoom-in': {
      ctx.globalAlpha = 1 - progress;
      ctx.filter = itemFilter(fromItem, cssFilter);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      const zis  = 0.5 + 0.5 * progress;
      const zidw = W * zis;
      const zidh = H * zis;
      ctx.globalAlpha = progress;
      ctx.filter = itemFilter(toItem, cssFilter);
      drawItemAtRect(ctx, toItem, W, H, toRaw, (W - zidw) / 2, (H - zidh) / 2, zidw, zidh);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      break;
    }

    case 'zoom-out': {
      ctx.filter = itemFilter(toItem, cssFilter);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
      const zos  = 1 - 0.5 * progress;
      const zodw = W * zos;
      const zodh = H * zos;
      ctx.globalAlpha = 1 - progress;
      ctx.filter = itemFilter(fromItem, cssFilter);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, (W - zodw) / 2, (H - zodh) / 2, zodw, zodh);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      break;
    }
  }

  // During transition, incoming scene style wins
  applyStyle(ctx, toItem.style ?? style, W, H);
  renderOverlays();
  if (config.watermark) drawWatermark(ctx, config.watermark, W, H);
  if (config.grain && config.grain > 0) applyFilmGrain(ctx, W, H, config.grain);
}

// ── Pass 2: add audio track in real-time ──────────────────────────────────────
//
// Plays the Pass-1 video through a <video> element and re-records it with an
// AudioContext music track mixed in. No filters — they are already baked into
// the Pass-1 video. video.play() drives timing so audio is always in sync.

async function addAudioToVideo(
  videoBlob: Blob,
  voiceoverFile: File | null,
  musicFile: File | null,
  mimeType: string,
  onProgress: (p: number) => void,
  expectedDuration?: number,
  audioClips?: Array<{ sourceUrl: string; startTime: number; duration: number; volume?: number; fadeInDuration?: number; fadeOutDuration?: number }>,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const video    = document.createElement('video');
    video.src         = videoUrl;
    video.muted       = true;
    video.playsInline = true;
    video.preload     = 'auto';

    video.addEventListener('error', () => reject(new Error('Audio-pass video failed to load')), { once: true });

    video.addEventListener('loadedmetadata', async () => {
      // WebM blobs from MediaRecorder often report Infinity duration — fall back to
      // the timeline length computed by renderSlideshow so fades and the stop
      // condition use the real video length, not the music file's length.
      let duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        console.warn('[slideshow] video.duration is', duration, '— using expectedDuration:', expectedDuration);
        duration = expectedDuration ?? 15;
      }

      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      try {
        const audioCtx  = new AudioContext();
        await audioCtx.resume();

        const audioDest = audioCtx.createMediaStreamDestination();
        const sources: AudioBufferSourceNode[] = [];

        const startAt = audioCtx.currentTime;
        const fadeAt  = Math.max(startAt, startAt + duration - 2);

        // Voiceover track -- full volume, no loop
        if (voiceoverFile) {
          const buf = await audioCtx.decodeAudioData(await voiceoverFile.arrayBuffer());
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.loop   = false;
          const gain = audioCtx.createGain();
          src.connect(gain);
          gain.connect(audioDest);
          gain.gain.setValueAtTime(1, startAt);
          gain.gain.setValueAtTime(1, fadeAt);
          gain.gain.linearRampToValueAtTime(0, startAt + duration);
          src.start(startAt);
          sources.push(src);
        }

        // Music track -- low volume background, looping
        if (musicFile) {
          const buf = await audioCtx.decodeAudioData(await musicFile.arrayBuffer());
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.loop   = true;
          const gain = audioCtx.createGain();
          src.connect(gain);
          gain.connect(audioDest);
          // If voiceover present: music at 22% so voice is clear
          // If only music: full volume (existing behavior)
          const musicVol = voiceoverFile ? 0.22 : 1.0;
          gain.gain.setValueAtTime(musicVol, startAt);
          gain.gain.setValueAtTime(musicVol, fadeAt);
          gain.gain.linearRampToValueAtTime(0, startAt + duration);
          src.start(startAt);
          sources.push(src);
        }

        // Timeline audio clips (video original audio tracks)
        if (audioClips && audioClips.length > 0) {
          await Promise.all(audioClips.map(async (clip) => {
            if (!clip.sourceUrl) return;
            try {
              const res = await fetch(clip.sourceUrl);
              if (!res.ok) return;
              const arrayBuf = await res.arrayBuffer();
              const buf = await audioCtx.decodeAudioData(arrayBuf);
              const src = audioCtx.createBufferSource();
              const gain = audioCtx.createGain();
              src.buffer = buf;
              src.connect(gain);
              gain.connect(audioDest);
              const vol     = clip.volume ?? 1;
              const fadeIn  = clip.fadeInDuration  ?? 0.3;
              const fadeOut = clip.fadeOutDuration ?? 0.3;
              const clipStart = startAt + clip.startTime;
              const clipEnd   = clipStart + clip.duration;
              gain.gain.setValueAtTime(0,   clipStart);
              gain.gain.linearRampToValueAtTime(vol, clipStart + Math.max(fadeIn, 0.01));
              gain.gain.setValueAtTime(vol, Math.max(clipStart, clipEnd - Math.max(fadeOut, 0.01)));
              gain.gain.linearRampToValueAtTime(0, clipEnd);
              src.start(clipStart, 0, clip.duration);
              sources.push(src);
            } catch (err) {
              console.warn('[export] Skipping audio clip (fetch/decode failed):', err);
            }
          }));
        }

        const videoStream  = canvas.captureStream(30);
        const mergedStream = new MediaStream([
          ...videoStream.getTracks(),
          ...audioDest.stream.getTracks(),
        ]);

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(mergedStream, { mimeType, videoBitsPerSecond: 8_000_000 });
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = () => {
          URL.revokeObjectURL(videoUrl);
          videoStream.getTracks().forEach((t) => t.stop());
          audioCtx.close().catch(() => {});
          resolve(new Blob(chunks, { type: mimeType }));
        };

        recorder.start(500);

        const stop = () => {
          if (recorder.state !== 'recording') return;
          sources.forEach((src) => { try { src.stop(); } catch { /* already stopped */ } });
          recorder.stop();
        };

        const drawVideoFrame = () => {
          if (video.ended || video.currentTime >= duration - 0.1) {
            setTimeout(stop, 100);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          onProgress(video.currentTime / duration);
          requestAnimationFrame(drawVideoFrame);
        };

        video.currentTime = 0;
        void video.play().catch(() => {});
        drawVideoFrame();

        // Safety timeout in case video.ended never fires
        setTimeout(stop, (duration + 3) * 1000);

      } catch (err) {
        URL.revokeObjectURL(videoUrl);
        reject(err);
      }
    }, { once: true });

    video.load();
  });
}

// ── WebCodecs Pass 1 renderer ─────────────────────────────────────────────────

/**
 * Render Pass 1 using WebCodecs — deterministic timestamps, frame-accurate output.
 * Render speed does NOT affect output duration — key difference from MediaRecorder.
 */
async function renderPass1WebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  items: SlideshowItem[],
  startTimes: number[],
  totalFrames: number,
  fps: number,
  W: number,
  H: number,
  onProgress: OnProgress,
  progressMax: number,
): Promise<Blob> {
  const frameDurationUs = Math.round(1_000_000 / fps);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H },
    fastStart: 'in-memory',
  });

  const codecCandidates = ['avc1.640028', 'avc1.4d0028', 'avc1.42E01E', 'avc1.42001f'];
  let selectedCodec: string | null = null;
  for (const codec of codecCandidates) {
    const support = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 8_000_000, framerate: fps });
    if (support.supported) { selectedCodec = codec; break; }
  }
  if (!selectedCodec) throw new Error('No supported H.264 video encoder found');

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? {}),
    error: (e) => console.error('[WebCodecs] Encoder error:', e),
  });
  encoder.configure({ codec: selectedCodec, width: W, height: H, bitrate: 8_000_000, framerate: fps });

  const MAX_QUEUE = 30;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;

    // Seek all active video items and wait for frame decode
    let didSeekAny = false;
    const activeVideos: HTMLVideoElement[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type !== 'video') continue;
      const video     = items[i].element as HTMLVideoElement;
      const itemStart = startTimes[i];
      const itemEnd   = startTimes[i] + items[i].duration;
      if (t >= itemStart && t < itemEnd) {
        activeVideos.push(video);
        const videoOffset = t - itemStart;
        if (Math.abs(video.currentTime - videoOffset) > 0.02) {
          await seekVideoToTime(video, videoOffset).catch(() => {});
          didSeekAny = true;
        }
      }
    }
    // Wait for browser to decode new frame pixels (seeked event != decoded pixels)
    if (didSeekAny) {
      await Promise.all(activeVideos.map(v => waitForVideoFrame(v)));
    }

    drawFrame(ctx, config, startTimes, frame);

    const videoFrame = new VideoFrame(canvas, { timestamp: frame * frameDurationUs });

    while (encoder.encodeQueueSize >= MAX_QUEUE) {
      await new Promise<void>((resolve) => {
        encoder.addEventListener('dequeue', () => resolve(), { once: true });
      });
    }

    encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    videoFrame.close();

    onProgress({ currentFrame: frame, totalFrames, percent: Math.round((frame / totalFrames) * progressMax), phase: 'rendering' });
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return new Blob([target.buffer], { type: 'video/mp4' });
}

// ── MediaRecorder fallback Pass 1 renderer ────────────────────────────────────

/**
 * Fallback Pass 1 renderer using MediaRecorder.
 * Used when WebCodecs is not available (older browsers, Firefox).
 */
async function renderPass1MediaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  items: SlideshowItem[],
  startTimes: number[],
  totalFrames: number,
  fps: number,
  onProgress: OnProgress,
  progressMax: number,
): Promise<Blob> {
  const mimeType = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  const videoStream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  drawFrame(ctx, config, startTimes, 0);
  recorder.start(500);

  const frameInterval = 1000 / fps;
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    const frameStart = performance.now();

    for (let i = 0; i < items.length; i++) {
      if (items[i].type !== 'video') continue;
      const video     = items[i].element as HTMLVideoElement;
      const itemStart = startTimes[i];
      const itemEnd   = startTimes[i] + items[i].duration;
      if (t >= itemStart && t < itemEnd) {
        const videoOffset = t - itemStart;
        if (Math.abs(video.currentTime - videoOffset) > 0.02) {
          await seekVideoToTime(video, videoOffset).catch(() => {});
        }
      }
    }

    drawFrame(ctx, config, startTimes, frame);

    onProgress({ currentFrame: frame, totalFrames, percent: Math.round((frame / totalFrames) * progressMax), phase: 'rendering' });

    const elapsed = performance.now() - frameStart;
    const waitTime = Math.max(0, frameInterval - elapsed);
    if (waitTime > 0) await new Promise<void>((r) => setTimeout(r, waitTime));
  }

  recorder.stop();
  videoStream.getTracks().forEach((t) => t.stop());
  await stopped;

  return new Blob(chunks, { type: mimeType });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function renderSlideshow(
  config: SlideshowConfig,
  onProgress: OnProgress,
): Promise<RenderResult> {
  const { items, transitionDuration, fps, outputSize } = config;
  const W = outputSize.width;
  const H = outputSize.height;

  if (items.length < 2) throw new Error('At least 2 items required');

  const minDuration = Math.min(...items.map((item) => item.duration));
  // Silently fall back to hard cut rather than crashing export
  const safeTransition = transitionDuration < minDuration ? transitionDuration : 0;

  // Preload all video items — buffer them and seek to 0 so play() starts instantly
  for (const item of items) {
    if (item.type === 'video') {
      const video       = item.element as HTMLVideoElement;
      video.muted       = true;
      video.playsInline  = true;
      video.preload     = 'auto';
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.addEventListener('canplay', () => resolve(), { once: true });
          video.load();
        });
      }
      await seekVideoToTime(video, 0).catch(() => {});
    }
  }

  // Precompute overlapping timeline
  const durations: number[]  = items.map((item) => item.duration);
  const startTimes: number[] = [];
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    startTimes.push(acc);
    if (i < items.length - 1) acc += durations[i] - safeTransition;
  }
  const totalDuration = durations.reduce((s, d) => s + d, 0) - (items.length - 1) * safeTransition;
  const totalFrames   = Math.max(1, Math.round(totalDuration * fps));

  // Create canvas
  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx     = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const hasAudio = !!config.audioFile || !!config.musicFile || (config.audioClips?.length ?? 0) > 0;
  const pass1Max = hasAudio ? 70 : 100;

  // ── Pass 1: video-only rendering ──────────────────────────────────────────────
  // WebCodecs: deterministic timestamps → frame-accurate output (preferred).
  // MediaRecorder: wall-clock based → fallback for browsers without WebCodecs.

  let videoBlob: Blob;
  let mimeType: string;

  const webCodecsAvailable = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

  if (webCodecsAvailable) {
    try {
      videoBlob = await renderPass1WebCodecs(
        canvas, ctx, config, items, startTimes, totalFrames, fps, W, H, onProgress, pass1Max,
      );
      mimeType = 'video/mp4';
      console.log('[export] Pass 1 completed via WebCodecs — frame-accurate MP4');
    } catch (err) {
      console.warn('[export] WebCodecs failed, falling back to MediaRecorder:', err);
      videoBlob = await renderPass1MediaRecorder(
        canvas, ctx, config, items, startTimes, totalFrames, fps, onProgress, pass1Max,
      );
      mimeType = videoBlob.type || 'video/webm';
    }
  } else {
    console.log('[export] WebCodecs not available, using MediaRecorder fallback');
    videoBlob = await renderPass1MediaRecorder(
      canvas, ctx, config, items, startTimes, totalFrames, fps, onProgress, pass1Max,
    );
    mimeType = videoBlob.type || 'video/webm';
  }

  onProgress({ currentFrame: totalFrames, totalFrames, percent: pass1Max, phase: 'rendering' });

  if (!hasAudio) return { blob: videoBlob, mimeType };

  // ── Pass 2: add audio in real-time ────────────────────────────────────────────
  // MediaRecorder for audio mixing — pick a mimeType it supports
  const audioPassMime = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  const finalBlob = await addAudioToVideo(
    videoBlob,
    config.audioFile ?? null,
    config.musicFile ?? null,
    audioPassMime,
    (p) => {
      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percent: pass1Max + Math.round(p * (100 - pass1Max)),
        phase: 'audio',
      });
    },
    totalDuration,
    config.audioClips,
  );

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100, phase: 'audio' });

  return { blob: finalBlob, mimeType: audioPassMime };
}
