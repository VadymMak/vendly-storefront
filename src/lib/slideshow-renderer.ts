/**
 * Client-side slideshow video renderer.
 * Uses Canvas + MediaRecorder — zero server CPU, runs entirely in browser.
 * Primary target: Chrome desktop (H.264 MP4). Falls back to WebM.
 *
 * Video items: played in real-time via video.play() — no per-frame seeking.
 * Image items: drawn with Ken Burns camera motion at frameInterval pace.
 *
 * Two-pass when audio is present:
 *   Pass 1 — render video-only (canvas.captureStream, no AudioContext).
 *             Audio starts at recording start, not after encoding delay.
 *   Pass 2 — play Pass-1 video + mix audio in real-time → final blob.
 */

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
  cardOverlays?: TextOverlay[];  // color-card only: overlays always shown during this item
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
  audioFile?: File;
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
  style: 'brand' | 'subtitle' | 'cta';
  from?: number;  // seconds from clip start; omit = always visible
  to?: number;    // seconds from clip end; omit = always visible
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

interface MotionPreset {
  startScale: number;
  endScale:   number;
  startPanX:  number;
  startPanY:  number;
  endPanX:    number;
  endPanY:    number;
}

const MOTION_PRESETS: Record<CameraMotion, MotionPreset> = {
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
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); resolve(); };
    const onError  = () => { video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); reject(new Error('Video seek failed')); };
    if (Math.abs(video.currentTime - time) < 0.01) { resolve(); return; }
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
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

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  W: number,
  H: number,
): void {
  ctx.save();
  ctx.shadowBlur = 0;

  switch (overlay.style) {
    case 'brand': {
      const fontSize = Math.round(W * 0.055);
      ctx.font = `bold ${fontSize}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = overlay.position === 'top' ? H * 0.14 : overlay.position === 'bottom' ? H * 0.86 : H * 0.5;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(overlay.text, W / 2, y);
      const metrics = ctx.measureText(overlay.text);
      const lineW = Math.min(metrics.width * 0.4, W * 0.25);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(W / 2 - lineW / 2, y + fontSize * 0.7, lineW, 1.5);
      break;
    }

    case 'subtitle': {
      const fontSize = Math.round(W * 0.032);
      ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const y = overlay.position === 'top' ? H * 0.12 : overlay.position === 'center' ? H * 0.55 : H * 0.91;
      const metrics = ctx.measureText(overlay.text);
      const padX = fontSize * 0.7;
      const padY = fontSize * 0.35;
      const bgX = W / 2 - metrics.width / 2 - padX;
      const bgY = y - fontSize - padY;
      const bgW = metrics.width + padX * 2;
      const bgH = fontSize + padY * 2;
      const r   = bgH / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, r);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(overlay.text, W / 2, y);
      break;
    }

    case 'cta': {
      const fontSize = Math.round(W * 0.038);
      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = overlay.position === 'top' ? H * 0.12 : overlay.position === 'center' ? H * 0.5 : H * 0.87;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(overlay.text, W / 2, y);
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
        drawTextOverlay(ctx, overlay, W, H);
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
    if (item.type === 'color-card' && item.cardOverlays) {
      for (const ov of item.cardOverlays) drawTextOverlay(ctx, ov, W, H);
    }
    if (config.watermark) drawWatermark(ctx, config.watermark, W, H);
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
}

// ── Pass 2: add audio track in real-time ──────────────────────────────────────
//
// Plays the Pass-1 video through a <video> element and re-records it with an
// AudioContext music track mixed in. No filters — they are already baked into
// the Pass-1 video. video.play() drives timing so audio is always in sync.

async function addAudioToVideo(
  videoBlob: Blob,
  audioFile: File,
  mimeType: string,
  onProgress: (p: number) => void,
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
      const duration = video.duration;

      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      try {
        const audioCtx = new AudioContext();
        await audioCtx.resume();
        const audioBuffer = await audioCtx.decodeAudioData(await audioFile.arrayBuffer());

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop   = true;

        const gain = audioCtx.createGain();
        source.connect(gain);

        const audioDest = audioCtx.createMediaStreamDestination();
        gain.connect(audioDest);

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

        const startAt = audioCtx.currentTime;
        const fadeAt  = Math.max(startAt, startAt + duration - 2);
        gain.gain.setValueAtTime(1, startAt);
        gain.gain.setValueAtTime(1, fadeAt);
        gain.gain.linearRampToValueAtTime(0, startAt + duration);
        source.start(startAt);

        video.currentTime = 0;
        await video.play();

        const stop = () => {
          if (recorder.state !== 'recording') return;
          try { source.stop(); } catch { /* already stopped */ }
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
  if (transitionDuration >= minDuration) {
    throw new Error('Transition duration must be shorter than the shortest clip duration');
  }

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
    if (i < items.length - 1) acc += durations[i] - transitionDuration;
  }
  const totalDuration = durations.reduce((s, d) => s + d, 0) - (items.length - 1) * transitionDuration;
  const totalFrames   = Math.max(1, Math.round(totalDuration * fps));

  // Create canvas
  const canvas  = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx     = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Pick MIME type — prefer H.264 MP4, fall back to WebM
  const mimeType = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  const hasAudio = !!config.audioFile;
  const pass1Max = hasAudio ? 70 : 100;

  // ── Pass 1: video-only (no AudioContext, no audio track in MediaStream) ──────
  // Filters are applied to image items via itemFilter() as in the working build.
  // Audio is deferred to Pass 2 so its start time is never affected by encoding.

  const videoStream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  drawFrame(ctx, config, startTimes, 0);
  recorder.start(500);

  const frameInterval = 1000 / fps;
  const startedVideos = new Set<number>();

  for (let frame = 0; frame < totalFrames; frame++) {
    const t          = frame / fps;
    const frameStart = performance.now();

    for (let i = 0; i < items.length; i++) {
      if (items[i].type !== 'video') continue;
      const video     = items[i].element as HTMLVideoElement;
      const itemStart = startTimes[i];
      const itemEnd   = startTimes[i] + items[i].duration;

      if (t >= itemStart && t < itemEnd && !startedVideos.has(i)) {
        video.currentTime = 0;
        try { await video.play(); } catch { /* autoplay policy — proceed with static frame */ }
        startedVideos.add(i);
      } else if (t >= itemEnd && startedVideos.has(i)) {
        video.pause();
        startedVideos.delete(i);
      }
    }

    drawFrame(ctx, config, startTimes, frame);

    onProgress({ currentFrame: frame, totalFrames, percent: Math.round((frame / totalFrames) * pass1Max), phase: 'rendering' });

    const elapsed  = performance.now() - frameStart;
    const waitTime = Math.max(0, frameInterval - elapsed);
    await new Promise<void>((r) => setTimeout(r, waitTime));
  }

  for (const idx of startedVideos) {
    (items[idx].element as HTMLVideoElement).pause();
  }

  recorder.stop();
  videoStream.getTracks().forEach((t) => t.stop());
  await stopped;

  onProgress({ currentFrame: totalFrames, totalFrames, percent: pass1Max, phase: 'rendering' });

  const videoBlob = new Blob(chunks, { type: mimeType });

  if (!hasAudio) return { blob: videoBlob, mimeType };

  // ── Pass 2: add audio in real-time ────────────────────────────────────────────
  const finalBlob = await addAudioToVideo(
    videoBlob,
    config.audioFile!,
    mimeType,
    (p) => {
      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percent: pass1Max + Math.round(p * (100 - pass1Max)),
        phase: 'audio',
      });
    },
  );

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100, phase: 'audio' });

  return { blob: finalBlob, mimeType };
}
