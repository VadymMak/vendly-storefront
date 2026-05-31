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

export interface SlideshowConfig {
  images: HTMLImageElement[];
  durationPerImage: number;         // seconds (3-8)
  transitionDuration: number;       // seconds (0.5-1.5)
  transitionType: TransitionType;
  cameraMotions?: (CameraMotion | null)[];  // per-image, null = no motion
  outputSize: { width: number; height: number };
  fps: number;                      // 30 recommended
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

const MOTION_PRESETS: Record<CameraMotion, MotionPreset> = {
  'zoom-in':      { startScale: 1.00, endScale: 1.10, startPanX:  0.00, startPanY:  0.00, endPanX:  0.02, endPanY: -0.02 },
  'zoom-out':     { startScale: 1.12, endScale: 1.00, startPanX:  0.02, startPanY:  0.02, endPanX:  0.00, endPanY:  0.00 },
  'pan-right':    { startScale: 1.08, endScale: 1.08, startPanX: -0.10, startPanY:  0.00, endPanX:  0.10, endPanY:  0.00 },
  'pan-left':     { startScale: 1.08, endScale: 1.08, startPanX:  0.10, startPanY:  0.00, endPanX: -0.10, endPanY:  0.00 },
  'pan-up':       { startScale: 1.08, endScale: 1.08, startPanX:  0.00, startPanY:  0.08, endPanX:  0.00, endPanY: -0.08 },
  'pan-down':     { startScale: 1.08, endScale: 1.08, startPanX:  0.00, startPanY: -0.08, endPanX:  0.00, endPanY:  0.08 },
  'diagonal-zoom':{ startScale: 1.00, endScale: 1.08, startPanX: -0.06, startPanY: -0.04, endPanX:  0.06, endPanY:  0.04 },
};

// ── Easing ────────────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// ── Crop helpers ──────────────────────────────────────────────────────────────

// CSS object-fit: cover source rect (no motion)
function coverRect(
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(canvasW / imgW, canvasH / imgH);
  const sw = canvasW / scale;
  const sh = canvasH / scale;
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh };
}

// Source crop rect for a specific motion preset at eased progress (0–1)
function getCropRect(
  motion: CameraMotion,
  eased: number,           // already eased, 0–1
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const p = MOTION_PRESETS[motion];
  const scale = p.startScale + (p.endScale - p.startScale) * eased;
  const panX  = p.startPanX + (p.endPanX - p.startPanX) * eased;
  const panY  = p.startPanY + (p.endPanY - p.startPanY) * eased;

  // Cover-crop base (same ratio as canvas, full image)
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

// Returns the source rect for an image at rawProgress (0–1) in its display window
function getMotionCrop(
  img: HTMLImageElement,
  motion: CameraMotion | null,
  rawProgress: number,
  W: number, H: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!motion) return coverRect(img.naturalWidth, img.naturalHeight, W, H);
  return getCropRect(motion, easeInOutCubic(rawProgress), img.naturalWidth, img.naturalHeight, W, H);
}

// Draw image at full canvas size with camera motion applied
function drawWithMotion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number, H: number,
  motion: CameraMotion | null,
  rawProgress: number,
): void {
  const { sx, sy, sw, sh } = getMotionCrop(img, motion, rawProgress, W, H);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

// ── Frame state ───────────────────────────────────────────────────────────────
//
// Overlapping model: transitions share time with adjacent images.
//   step         = durationPerImage - transitionDuration
//   startTime[i] = i * step
//   endTime[i]   = startTime[i] + durationPerImage
//   transition i→i+1 occupies [(i+1)*step, i*step + durationPerImage)
//   totalDuration = n*durationPerImage - (n-1)*transitionDuration

type FrameState =
  | { kind: 'steady'; imageIndex: number; progress: number }
  | { kind: 'transition'; fromIndex: number; toIndex: number; progress: number };

function getFrameState(
  frame: number,
  fps: number,
  durationPerImage: number,
  transitionDuration: number,
  numImages: number,
): FrameState {
  const t    = frame / fps;
  const step = durationPerImage - transitionDuration;

  // Check transitions first (overlap windows take priority)
  for (let i = 0; i < numImages - 1; i++) {
    const transStart = (i + 1) * step;
    const transEnd   = i * step + durationPerImage; // = transStart + transitionDuration

    if (t >= transStart && t < transEnd) {
      return {
        kind:      'transition',
        fromIndex: i,
        toIndex:   i + 1,
        progress:  (t - transStart) / transitionDuration,
      };
    }
  }

  // Steady: find which single image covers time t
  for (let i = 0; i < numImages; i++) {
    const imgStart = i * step;
    const imgEnd   = imgStart + durationPerImage;

    if (t >= imgStart && t < imgEnd) {
      return {
        kind:       'steady',
        imageIndex: i,
        progress:   (t - imgStart) / durationPerImage,
      };
    }
  }

  return { kind: 'steady', imageIndex: numImages - 1, progress: 1 };
}

// ── Frame drawing ─────────────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  resolvedMotions: (CameraMotion | null)[],
  frame: number,
): void {
  const { images, durationPerImage, transitionDuration, transitionType, fps, outputSize } = config;
  const W    = outputSize.width;
  const H    = outputSize.height;
  const step = durationPerImage - transitionDuration;
  const t    = frame / fps;

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const state = getFrameState(frame, fps, durationPerImage, transitionDuration, images.length);

  if (state.kind === 'steady') {
    const imgProgress = Math.max(0, Math.min(1, (t - state.imageIndex * step) / durationPerImage));
    drawWithMotion(ctx, images[state.imageIndex], W, H, resolvedMotions[state.imageIndex], imgProgress);
    return;
  }

  // Transition: compute per-image progress within their display windows
  const { fromIndex, toIndex, progress } = state;
  const fromImg = images[fromIndex];
  const toImg   = images[toIndex];
  const fromProgress = Math.max(0, Math.min(1, (t - fromIndex * step) / durationPerImage));
  const toProgress   = Math.max(0, Math.min(1, (t - toIndex * step)   / durationPerImage));
  const fromMotion   = resolvedMotions[fromIndex];
  const toMotion     = resolvedMotions[toIndex];

  switch (transitionType) {
    case 'fade': {
      ctx.globalAlpha = 1 - progress;
      drawWithMotion(ctx, fromImg, W, H, fromMotion, fromProgress);
      ctx.globalAlpha = progress;
      drawWithMotion(ctx, toImg,   W, H, toMotion,   toProgress);
      ctx.globalAlpha = 1;
      break;
    }

    case 'slide-left': {
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(-progress * W, 0);
      drawWithMotion(ctx, fromImg, W, H, fromMotion, fromProgress);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - progress) * W, 0);
      drawWithMotion(ctx, toImg, W, H, toMotion, toProgress);
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
      drawWithMotion(ctx, fromImg, W, H, fromMotion, fromProgress);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - progress) * W, 0);
      drawWithMotion(ctx, toImg, W, H, toMotion, toProgress);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'zoom-in': {
      // from fades out at full size; to zooms up (0.5→1) while fading in
      ctx.globalAlpha = 1 - progress;
      drawWithMotion(ctx, fromImg, W, H, fromMotion, fromProgress);
      const s  = 0.5 + 0.5 * progress;
      const dw = W * s;
      const dh = H * s;
      const { sx, sy, sw, sh } = getMotionCrop(toImg, toMotion, toProgress, W, H);
      ctx.globalAlpha = progress;
      ctx.drawImage(toImg, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      break;
    }

    case 'zoom-out': {
      // to is at full size underneath; from shrinks (1→0.5) while fading out
      drawWithMotion(ctx, toImg, W, H, toMotion, toProgress);
      const s  = 1 - 0.5 * progress;
      const dw = W * s;
      const dh = H * s;
      const { sx, sy, sw, sh } = getMotionCrop(fromImg, fromMotion, fromProgress, W, H);
      ctx.globalAlpha = 1 - progress;
      ctx.drawImage(fromImg, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      break;
    }
  }
}

// ── Audio setup ───────────────────────────────────────────────────────────────

interface AudioSetup {
  audioCtx: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  source: AudioBufferSourceNode;
}

async function setupAudio(
  file: File,
  totalDuration: number,
): Promise<AudioSetup> {
  const audioCtx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const destination = audioCtx.createMediaStreamDestination();
  const gainNode    = audioCtx.createGain();

  // Fade out in the last 2 seconds
  const fadeStart = Math.max(0, totalDuration - 2);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  if (fadeStart > 0) {
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime + fadeStart);
  }
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
  const { images, durationPerImage, transitionDuration, fps, outputSize } = config;
  const W = outputSize.width;
  const H = outputSize.height;

  if (images.length < 2) throw new Error('At least 2 images required');
  if (transitionDuration >= durationPerImage) {
    throw new Error('Transition duration must be shorter than duration per image');
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  // High-quality scaling for all frames
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Resolve camera motions: use provided array, or fall back to DEFAULT_SEQUENCE
  const resolvedMotions: (CameraMotion | null)[] = images.map((_, i) => {
    if (config.cameraMotions) return config.cameraMotions[i] ?? null;
    return DEFAULT_SEQUENCE[i % DEFAULT_SEQUENCE.length];
  });

  // Overlapping model: transitions share time with adjacent images
  const totalDuration = images.length * durationPerImage - (images.length - 1) * transitionDuration;
  const totalFrames   = Math.max(1, Math.round(totalDuration * fps));

  // Pick MIME type — prefer H.264 MP4, fall back to WebM
  const mimeType = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  // Optional audio
  let audio: AudioSetup | null = null;
  if (config.audioFile) {
    try {
      audio = await setupAudio(config.audioFile, totalDuration);
    } catch {
      audio = null;
    }
  }

  // Build media stream
  const videoStream = canvas.captureStream(fps);
  const tracks: MediaStreamTrack[] = [...videoStream.getTracks()];
  if (audio) tracks.push(...audio.destination.stream.getTracks());
  const mediaStream = new MediaStream(tracks);

  // Set up recorder
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(mediaStream, { mimeType });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // Draw first frame before starting recorder (avoids blank first frame)
  drawFrame(ctx, config, resolvedMotions, 0);

  recorder.start(500);
  audio?.source.start(audio.audioCtx.currentTime);

  // Render loop — pace to real-time so captureStream captures each frame
  const frameMs     = 1000 / fps;
  const renderStart = performance.now();

  for (let frame = 0; frame < totalFrames; frame++) {
    drawFrame(ctx, config, resolvedMotions, frame);

    onProgress({
      currentFrame: frame,
      totalFrames,
      percent: Math.round((frame / totalFrames) * 100),
    });

    const targetMs = renderStart + (frame + 1) * frameMs;
    const delay    = targetMs - performance.now();
    if (delay > 0) await new Promise<void>((r) => setTimeout(r, delay));
  }

  try { audio?.source.stop(); } catch { /* already stopped */ }

  recorder.stop();
  videoStream.getTracks().forEach((t) => t.stop());

  await stopped;

  if (audio) await audio.audioCtx.close().catch(() => {});

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100 });

  return { blob: new Blob(chunks, { type: mimeType }), mimeType };
}
