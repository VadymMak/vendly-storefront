/**
 * Client-side slideshow video renderer.
 * Uses Canvas + MediaRecorder — zero server CPU, runs entirely in browser.
 * Primary target: Chrome desktop (H.264 MP4). Falls back to WebM.
 */

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out';

export type CameraMotion =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'diagonal-zoom';

// Each slide item: image or short video clip
export interface SlideshowItem {
  type: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  duration: number;         // seconds — image: durationPerImage setting; video: video.duration
  motion?: CameraMotion;    // images only; undefined = static (no Ken Burns)
}

export interface SlideshowConfig {
  items: SlideshowItem[];
  transitionDuration: number;  // seconds (0.5–1.5)
  transitionType: TransitionType;
  outputSize: { width: number; height: number };
  fps: number;                 // 30 recommended
  audioFile?: File;
}

export interface RenderProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
}

export type OnProgress = (progress: RenderProgress) => void;

export interface RenderResult {
  blob: Blob;
  mimeType: string;
}

// ── Camera motion ──────────────────────────────────────────────────────────────

// Automatic sequence — varied types, no two adjacent are the same
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

// Increased amplitudes for visible motion on mobile/Instagram screens
const MOTION_PRESETS: Record<CameraMotion, MotionPreset> = {
  'zoom-in':       { startScale: 1.00, endScale: 1.15, startPanX:  0.00, startPanY:  0.00, endPanX:  0.04, endPanY: -0.04 },
  'zoom-out':      { startScale: 1.18, endScale: 1.00, startPanX:  0.04, startPanY:  0.04, endPanX:  0.00, endPanY:  0.00 },
  'pan-right':     { startScale: 1.10, endScale: 1.10, startPanX: -0.15, startPanY:  0.00, endPanX:  0.15, endPanY:  0.00 },
  'pan-left':      { startScale: 1.10, endScale: 1.10, startPanX:  0.15, startPanY:  0.00, endPanX: -0.15, endPanY:  0.00 },
  'pan-up':        { startScale: 1.10, endScale: 1.10, startPanX:  0.00, startPanY:  0.12, endPanX:  0.00, endPanY: -0.12 },
  'pan-down':      { startScale: 1.10, endScale: 1.10, startPanX:  0.00, startPanY: -0.12, endPanX:  0.00, endPanY:  0.12 },
  'diagonal-zoom': { startScale: 1.00, endScale: 1.12, startPanX: -0.08, startPanY: -0.06, endPanX:  0.08, endPanY:  0.06 },
};

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

// Source rect for image: motion crop or plain cover
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

// Draw item (image with optional motion, or video with cover crop) into destination rect.
// For video items: caller must await seekVideo before calling this.
function drawItemAtRect(
  ctx: CanvasRenderingContext2D,
  item: SlideshowItem,
  canvasW: number, canvasH: number,
  rawProgress: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (item.type === 'video') {
    const video = item.element as HTMLVideoElement;
    const vW    = video.videoWidth;
    const vH    = video.videoHeight;
    if (vW === 0 || vH === 0) return;
    // Object-fit: cover — always use canvas aspect for the crop
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
    const img         = item.element as HTMLImageElement;
    const { sx, sy, sw, sh } = getMotionCrop(img, item.motion ?? null, rawProgress, canvasW, canvasH);
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

// Seek video to time, resolving on 'seeked'; resolves immediately if already at time
async function seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Video seek failed'));
    };
    if (Math.abs(video.currentTime - time) < 0.01) { resolve(); return; }
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

// Seek video and ensure a decodable frame is available (readyState >= HAVE_CURRENT_DATA)
async function ensureVideoFrame(video: HTMLVideoElement, time: number): Promise<void> {
  const clamped = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));
  try { await seekVideoToTime(video, clamped); } catch { /* proceed with current frame */ }
  if (video.readyState < 2) await new Promise<void>((r) => setTimeout(r, 50));
}

// ── Frame state ───────────────────────────────────────────────────────────────
//
// Overlapping model with variable per-item durations:
//   step[i]      = durations[i] - transitionDuration
//   startTime[i] = sum(step[0..i-1])
//   endTime[i]   = startTime[i] + durations[i]
//   transition i→i+1 occupies [startTime[i+1], endTime[i])
//   totalDuration = sum(durations) - (n-1) * transitionDuration

type FrameState =
  | { kind: 'steady';     imageIndex: number;                             progress: number }
  | { kind: 'transition'; fromIndex:  number; toIndex: number;            progress: number };

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
      return {
        kind:      'transition',
        fromIndex: i,
        toIndex:   i + 1,
        progress:  (t - transStart) / transitionDuration,
      };
    }
  }

  for (let i = 0; i < n; i++) {
    const imgStart = startTimes[i];
    const imgEnd   = imgStart + durations[i];
    if (t >= imgStart && t < imgEnd) {
      return {
        kind:       'steady',
        imageIndex: i,
        progress:   (t - imgStart) / durations[i],
      };
    }
  }

  return { kind: 'steady', imageIndex: n - 1, progress: 1 };
}

// ── Frame drawing ─────────────────────────────────────────────────────────────

async function drawFrame(
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  startTimes: number[],
  frame: number,
): Promise<void> {
  const { items, transitionDuration, transitionType, fps, outputSize } = config;
  const W        = outputSize.width;
  const H        = outputSize.height;
  const t        = frame / fps;
  const durations = items.map((item) => item.duration);

  ctx.globalAlpha = 1;
  ctx.fillStyle   = '#000';
  ctx.fillRect(0, 0, W, H);

  const state = getFrameState(frame, fps, startTimes, durations, transitionDuration);

  if (state.kind === 'steady') {
    const item       = items[state.imageIndex];
    const rawProgress = Math.max(0, Math.min(1, (t - startTimes[state.imageIndex]) / item.duration));
    if (item.type === 'video') {
      await ensureVideoFrame(item.element as HTMLVideoElement, rawProgress * item.duration);
    }
    drawItemAtRect(ctx, item, W, H, rawProgress, 0, 0, W, H);
    return;
  }

  // Transition
  const { fromIndex, toIndex, progress } = state;
  const fromItem  = items[fromIndex];
  const toItem    = items[toIndex];
  const fromRaw   = Math.max(0, Math.min(1, (t - startTimes[fromIndex]) / fromItem.duration));
  const toRaw     = Math.max(0, Math.min(1, (t - startTimes[toIndex])   / toItem.duration));

  if (fromItem.type === 'video') {
    await ensureVideoFrame(fromItem.element as HTMLVideoElement, fromRaw * fromItem.duration);
  }
  if (toItem.type === 'video') {
    await ensureVideoFrame(toItem.element as HTMLVideoElement, toRaw * toItem.duration);
  }

  switch (transitionType) {
    case 'fade': {
      ctx.globalAlpha = 1 - progress;
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.globalAlpha = progress;
      drawItemAtRect(ctx, toItem,   W, H, toRaw,   0, 0, W, H);
      ctx.globalAlpha = 1;
      break;
    }

    case 'slide-left': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(-progress * W, 0);
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - progress) * W, 0);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
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
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - progress) * W, 0);
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'zoom-in': {
      // from fades out at full size; to zooms up (0.5→1) while fading in
      ctx.globalAlpha = 1 - progress;
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, 0, 0, W, H);
      const s  = 0.5 + 0.5 * progress;
      const dw = W * s;
      const dh = H * s;
      ctx.globalAlpha = progress;
      drawItemAtRect(ctx, toItem, W, H, toRaw, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      break;
    }

    case 'zoom-out': {
      // to is at full size underneath; from shrinks (1→0.5) while fading out
      drawItemAtRect(ctx, toItem, W, H, toRaw, 0, 0, W, H);
      const s  = 1 - 0.5 * progress;
      const dw = W * s;
      const dh = H * s;
      ctx.globalAlpha = 1 - progress;
      drawItemAtRect(ctx, fromItem, W, H, fromRaw, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// ── Audio setup ───────────────────────────────────────────────────────────────

interface AudioSetup {
  audioCtx:    AudioContext;
  destination: MediaStreamAudioDestinationNode;
  source:      AudioBufferSourceNode;
}

async function setupAudio(file: File, totalDuration: number): Promise<AudioSetup> {
  const audioCtx   = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const destination = audioCtx.createMediaStreamDestination();
  const gainNode    = audioCtx.createGain();

  const fadeStart = Math.max(0, totalDuration - 2);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  if (fadeStart > 0) gainNode.gain.setValueAtTime(1, audioCtx.currentTime + fadeStart);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + totalDuration);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(destination);

  return { audioCtx, destination, source };
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

  // Preload all video items — ensure canplay readyState before rendering starts
  for (const item of items) {
    if (item.type === 'video') {
      const video      = item.element as HTMLVideoElement;
      video.muted      = true;
      video.playsInline = true;
      video.preload    = 'auto';
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
  const canvas   = document.createElement('canvas');
  canvas.width   = W;
  canvas.height  = H;
  const ctx      = canvas.getContext('2d');
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

  // Optional background audio
  let audio: AudioSetup | null = null;
  if (config.audioFile) {
    try { audio = await setupAudio(config.audioFile, totalDuration); } catch { audio = null; }
  }

  // Build media stream
  const videoStream  = canvas.captureStream(fps);
  const tracks: MediaStreamTrack[] = [...videoStream.getTracks()];
  if (audio) tracks.push(...audio.destination.stream.getTracks());
  const mediaStream  = new MediaStream(tracks);

  const chunks: Blob[] = [];
  const recorder       = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  // Draw first frame before starting recorder (avoids blank first frame)
  await drawFrame(ctx, config, startTimes, 0);

  recorder.start(500);
  audio?.source.start(audio.audioCtx.currentTime);

  // Per-frame interval timing: each frame must hold the canvas for at least frameInterval ms
  // so captureStream has time to sample it. setTimeout always yields to the compositor.
  const frameInterval = 1000 / fps;

  for (let frame = 0; frame < totalFrames; frame++) {
    const frameStart = performance.now();

    await drawFrame(ctx, config, startTimes, frame);

    onProgress({ currentFrame: frame, totalFrames, percent: Math.round((frame / totalFrames) * 100) });

    const elapsed  = performance.now() - frameStart;
    const waitTime = Math.max(0, frameInterval - elapsed);
    await new Promise<void>((r) => setTimeout(r, waitTime));
  }

  try { audio?.source.stop(); } catch { /* already stopped */ }

  recorder.stop();
  videoStream.getTracks().forEach((t) => t.stop());

  await stopped;
  if (audio) await audio.audioCtx.close().catch(() => {});

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100 });

  return { blob: new Blob(chunks, { type: mimeType }), mimeType };
}
