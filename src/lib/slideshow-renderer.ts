/**
 * Client-side slideshow video renderer.
 * Uses Canvas + MediaRecorder — zero server CPU, runs entirely in browser.
 * Primary target: Chrome desktop (H.264 MP4). Falls back to WebM.
 *
 * Two-pass architecture:
 *   Pass 1 — render video without audio as fast as possible (captureStream(0) + requestFrame).
 *   Pass 2 — play the Pass-1 video in real-time while recording with an audio track.
 *            video.play() drives timing → audio is guaranteed to stay in sync.
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
  type: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  duration: number;      // image: durationPerImage setting; video: video.duration
  motion?: CameraMotion; // images only; undefined = static
}

export interface SlideshowConfig {
  items: SlideshowItem[];
  transitionDuration: number;
  transitionType: TransitionType;
  outputSize: { width: number; height: number };
  fps: number;
  audioFile?: File;
  style?: VideoStyle; // default: 'none'
}

export interface RenderProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  phase: 'rendering' | 'adding-audio';
}

export type OnProgress = (progress: RenderProgress) => void;

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
// filteredSources: pre-filtered offscreen canvases for image items (filter applied once before render loop).
function drawItemAtRect(
  ctx: CanvasRenderingContext2D,
  item: SlideshowItem,
  canvasW: number, canvasH: number,
  rawProgress: number,
  dx: number, dy: number, dw: number, dh: number,
  filteredSources: Map<HTMLImageElement, HTMLCanvasElement>,
): void {
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
    const img    = item.element as HTMLImageElement;
    const source = filteredSources.get(img) ?? img;
    const { sx, sy, sw, sh } = getMotionCrop(img, item.motion ?? null, rawProgress, canvasW, canvasH);
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  startTimes: number[],
  frame: number,
  filteredSources: Map<HTMLImageElement, HTMLCanvasElement>,
): void {
  const { items, transitionDuration, transitionType, fps, outputSize, style = 'none' } = config;
  const W        = outputSize.width;
  const H        = outputSize.height;
  const t        = frame / fps;
  const durations = items.map((item) => item.duration);

  ctx.globalAlpha = 1;
  ctx.fillStyle   = '#000';
  ctx.fillRect(0, 0, W, H);

  const state = getFrameState(frame, fps, startTimes, durations, transitionDuration);

  if (state.kind === 'steady') {
    const item        = items[state.imageIndex];
    const rawProgress = Math.max(0, Math.min(1, (t - startTimes[state.imageIndex]) / item.duration));
    drawItemAtRect(ctx, item, W, H, rawProgress, 0, 0, W, H, filteredSources);
    applyStyle(ctx, style, W, H);
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
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H, filteredSources);
      ctx.globalAlpha = progress;
      drawItemAtRect(ctx, toItem,   W, H, toRaw,   0, 0, W, H, filteredSources);
      ctx.globalAlpha = 1;
      break;
    }

    case 'slide-left': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(-progress * W, 0);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H, filteredSources);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - progress) * W, 0);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H, filteredSources);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'slide-right': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(progress * W, 0);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H, filteredSources);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - progress) * W, 0);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H, filteredSources);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'zoom-in': {
      ctx.globalAlpha = 1 - progress;
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H, filteredSources);
      const zis  = 0.5 + 0.5 * progress;
      const zidw = W * zis;
      const zidh = H * zis;
      ctx.globalAlpha = progress;
      drawItemAtRect(ctx, toItem, W, H, toRaw, (W - zidw) / 2, (H - zidh) / 2, zidw, zidh, filteredSources);
      ctx.globalAlpha = 1;
      break;
    }

    case 'zoom-out': {
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H, filteredSources);
      const zos  = 1 - 0.5 * progress;
      const zodw = W * zos;
      const zodh = H * zos;
      ctx.globalAlpha = 1 - progress;
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, (W - zodw) / 2, (H - zodh) / 2, zodw, zodh, filteredSources);
      ctx.globalAlpha = 1;
      break;
    }
  }

  applyStyle(ctx, style, W, H);
}

// ── MIME type picker ──────────────────────────────────────────────────────────

function pickMimeType(): string {
  return (
    ['video/mp4; codecs="avc1.42E01E"', 'video/mp4', 'video/webm; codecs=vp9', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  );
}

// ── Pass 1: clean video render (no filters, captureStream(fps) + setTimeout) ──
//
// Renders at natural frame rate with no filters — fast enough to keep each frame
// within its 33ms budget. captureStream(fps) stamps correct timestamps automatically.
// Video items play in real-time via video.play() so their frames are always current.

async function renderVideoPass(
  config: SlideshowConfig,
  startTimes: number[],
  totalFrames: number,
  mimeType: string,
  onProgress: (frame: number) => void,
): Promise<Blob> {
  const { items, fps, outputSize } = config;
  const W = outputSize.width;
  const H = outputSize.height;
  const frameInterval = 1000 / fps;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // fps-driven capture — encoder receives correct timestamps without requestFrame()
  const videoStream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // No filters in Pass 1 — keeps frames fast so setTimeout(33ms) is honoured
  const cleanConfig: SlideshowConfig = { ...config, style: 'none' as VideoStyle };
  const emptyFiltered: Map<HTMLImageElement, HTMLCanvasElement> = new Map();
  const startedVideos = new Set<HTMLVideoElement>();

  return new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.start();

    (async () => {
      for (let frame = 0; frame < totalFrames; frame++) {
        const t          = frame / fps;
        const frameStart = performance.now();

        // Start video items at their content time via play() — no seeking needed
        for (let i = 0; i < items.length; i++) {
          if (items[i].type !== 'video') continue;
          const video     = items[i].element as HTMLVideoElement;
          const itemStart = startTimes[i];
          const itemEnd   = startTimes[i] + items[i].duration;
          if (t >= itemStart && t < itemEnd && !startedVideos.has(video)) {
            startedVideos.add(video);
            video.currentTime = 0;
            await video.play().catch(() => {});
          }
        }

        drawFrame(ctx, cleanConfig, startTimes, frame, emptyFiltered);
        onProgress(frame);

        // Hold frame for correct duration — critical for proper video playback speed
        const elapsed  = performance.now() - frameStart;
        const waitTime = Math.max(0, frameInterval - elapsed);
        if (waitTime > 0) await new Promise<void>((r) => setTimeout(r, waitTime));
      }

      for (const item of items) {
        if (item.type === 'video') (item.element as HTMLVideoElement).pause();
      }

      recorder.stop();
      videoStream.getTracks().forEach((t) => t.stop());
    })();
  });
}

// ── Pass 2: apply filters + audio in real-time ────────────────────────────────
//
// Plays the Pass-1 video through a <video> element and re-records it with:
//   • CSS filter applied via ctx.filter per frame (fast — just one drawImage)
//   • overlay/vignette/letterbox via applyStyle()
//   • optional AudioContext music track
// video.play() drives timing so audio is always in sync.

async function addFilterAndAudioPass(
  videoBlob: Blob,
  audioFile: File | undefined,
  style: VideoStyle,
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

    video.addEventListener('error', () => reject(new Error('Pass-2 video failed to load')), { once: true });

    video.addEventListener('loadedmetadata', async () => {
      const actualDuration = video.duration;
      const W = video.videoWidth;
      const H = video.videoHeight;

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      const cssFilter = style !== 'none' ? STYLE_PRESETS[style].filter : 'none';

      let audioCtx: AudioContext | null = null;
      let sourceNode: AudioBufferSourceNode | null = null;

      try {
        const videoStream = canvas.captureStream(30);
        const trackList: MediaStreamTrack[] = [...videoStream.getTracks()];

        if (audioFile) {
          audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(await audioFile.arrayBuffer());

          sourceNode = audioCtx.createBufferSource();
          sourceNode.buffer = audioBuffer;
          sourceNode.loop   = true;

          const gain = audioCtx.createGain();
          sourceNode.connect(gain);

          const audioDest = audioCtx.createMediaStreamDestination();
          gain.connect(audioDest);
          trackList.push(...audioDest.stream.getTracks());

          await audioCtx.resume();

          const startAt = audioCtx.currentTime;
          const fadeAt  = Math.max(startAt, startAt + actualDuration - 2);
          gain.gain.setValueAtTime(1, startAt);
          gain.gain.setValueAtTime(1, fadeAt);
          gain.gain.linearRampToValueAtTime(0, startAt + actualDuration);
          sourceNode.start(startAt);
        }

        const mergedStream = new MediaStream(trackList);
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(mergedStream, { mimeType, videoBitsPerSecond: 8_000_000 });
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        const cleanup = () => {
          URL.revokeObjectURL(videoUrl);
          videoStream.getTracks().forEach((t) => t.stop());
          audioCtx?.close().catch(() => {});
        };

        recorder.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: mimeType })); };
        recorder.start(500);

        video.currentTime = 0;
        await video.play();

        const stopRecording = () => {
          if (recorder.state !== 'recording') return;
          try { sourceNode?.stop(); } catch { /* already stopped */ }
          recorder.stop();
        };

        const drawVideoFrame = () => {
          if (video.ended || video.currentTime >= actualDuration) {
            stopRecording();
            return;
          }
          if (style !== 'none') ctx.filter = cssFilter;
          ctx.drawImage(video, 0, 0, W, H);
          ctx.filter = 'none';
          if (style !== 'none') applyStyle(ctx, style, W, H);
          onProgress(video.currentTime / actualDuration);
          requestAnimationFrame(drawVideoFrame);
        };
        drawVideoFrame();

        setTimeout(stopRecording, (actualDuration + 5) * 1000);

      } catch (err) {
        audioCtx?.close().catch(() => {});
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
  const { items, transitionDuration, fps } = config;
  const style = config.style ?? 'none';

  if (items.length < 2) throw new Error('At least 2 items required');

  const minDuration = Math.min(...items.map((item) => item.duration));
  if (transitionDuration >= minDuration) {
    throw new Error('Transition duration must be shorter than the shortest clip duration');
  }

  // Preload video items
  for (const item of items) {
    if (item.type === 'video') {
      const video       = item.element as HTMLVideoElement;
      video.muted       = true;
      video.playsInline = true;
      video.preload     = 'auto';
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.addEventListener('canplay', () => resolve(), { once: true });
          video.load();
        });
      }
    }
  }

  // Overlapping timeline
  const durations: number[]  = items.map((item) => item.duration);
  const startTimes: number[] = [];
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    startTimes.push(acc);
    if (i < items.length - 1) acc += durations[i] - transitionDuration;
  }
  const totalDuration = durations.reduce((s, d) => s + d, 0) - (items.length - 1) * transitionDuration;
  const totalFrames   = Math.max(1, Math.round(totalDuration * fps));

  const mimeType    = pickMimeType();
  const hasAudio    = !!config.audioFile;
  const needsPass2  = hasAudio || style !== 'none';
  const pass1Max    = needsPass2 ? 60 : 100;

  // Pass 1 — clean render (no filters → fast → correct frame timing)
  const videoBlob = await renderVideoPass(
    config,
    startTimes,
    totalFrames,
    mimeType,
    (frame) => {
      onProgress({
        currentFrame: frame,
        totalFrames,
        percent: Math.round((frame / totalFrames) * pass1Max),
        phase: 'rendering',
      });
    },
  );

  onProgress({ currentFrame: totalFrames, totalFrames, percent: pass1Max, phase: 'rendering' });

  if (!needsPass2) return { blob: videoBlob, mimeType };

  // Pass 2 — apply filters + audio in real-time via video.play()
  const finalBlob = await addFilterAndAudioPass(
    videoBlob,
    config.audioFile,
    style,
    mimeType,
    (p) => {
      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        percent: pass1Max + Math.round(p * (100 - pass1Max)),
        phase: 'adding-audio',
      });
    },
  );

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100, phase: 'adding-audio' });

  return { blob: finalBlob, mimeType };
}
