/**
 * Client-side slideshow video renderer.
 * Uses Canvas + MediaRecorder — zero server CPU, runs entirely in browser.
 * Primary target: Chrome desktop (H.264 MP4). Falls back to WebM.
 */

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out';

export interface SlideshowConfig {
  images: HTMLImageElement[];
  durationPerImage: number;    // seconds (3-8)
  transitionDuration: number;  // seconds (0.5-1.5)
  transitionType: TransitionType;
  kenBurns: boolean;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

interface KenBurnsParams {
  startScale: number;  // 1.05–1.15 (zoom into image)
  endScale: number;
  startPanX: number;   // fraction of canvas width, -0.05 to 0.05
  startPanY: number;
  endPanX: number;
  endPanY: number;
}

function generateKenBurns(): KenBurnsParams {
  return {
    startScale: 1.05 + Math.random() * 0.1,
    endScale:   1.05 + Math.random() * 0.1,
    startPanX:  (Math.random() - 0.5) * 0.06,
    startPanY:  (Math.random() - 0.5) * 0.06,
    endPanX:    (Math.random() - 0.5) * 0.06,
    endPanY:    (Math.random() - 0.5) * 0.06,
  };
}

// Compute source-crop rect for CSS-like object-fit: cover
function coverRect(
  imgW: number, imgH: number,
  canvasW: number, canvasH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(canvasW / imgW, canvasH / imgH);
  const sw = canvasW / scale;
  const sh = canvasH / scale;
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh };
}

// Draw image with cover crop + optional Ken Burns zoom/pan
function drawCoverKB(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number, H: number,
  kb: KenBurnsParams | null,
  progress: number, // 0–1 within this image's display time
): void {
  const { sx, sy, sw, sh } = coverRect(img.naturalWidth, img.naturalHeight, W, H);

  if (!kb) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return;
  }

  const scale = lerp(kb.startScale, kb.endScale, progress);
  const panX  = lerp(kb.startPanX,  kb.endPanX,  progress);
  const panY  = lerp(kb.startPanY,  kb.endPanY,  progress);

  // Transform: center image on canvas, apply extra scale + pan, then draw
  ctx.save();
  ctx.translate(W / 2 + panX * W, H / 2 + panY * H);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  ctx.restore();
}

// Plain cover draw (used during transitions to avoid transform conflicts)
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number, H: number,
): void {
  const { sx, sy, sw, sh } = coverRect(img.naturalWidth, img.naturalHeight, W, H);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

// ── Frame state ───────────────────────────────────────────────────────────────

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
  const t = frame / fps;
  let elapsed = 0;

  for (let i = 0; i < numImages; i++) {
    const steadyEnd = elapsed + durationPerImage;

    if (t < steadyEnd || i === numImages - 1) {
      return {
        kind: 'steady',
        imageIndex: i,
        progress: durationPerImage > 0
          ? Math.min(1, (t - elapsed) / durationPerImage)
          : 1,
      };
    }

    elapsed = steadyEnd;
    const transitionEnd = elapsed + transitionDuration;

    if (t < transitionEnd) {
      return {
        kind: 'transition',
        fromIndex: i,
        toIndex: i + 1,
        progress: (t - elapsed) / transitionDuration,
      };
    }

    elapsed = transitionEnd;
  }

  return { kind: 'steady', imageIndex: numImages - 1, progress: 1 };
}

// ── Frame drawing ─────────────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  config: SlideshowConfig,
  kbParams: (KenBurnsParams | null)[],
  frame: number,
): void {
  const { images, durationPerImage, transitionDuration, transitionType, fps, outputSize } = config;
  const W = outputSize.width;
  const H = outputSize.height;

  // Clear to black
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const state = getFrameState(frame, fps, durationPerImage, transitionDuration, images.length);

  if (state.kind === 'steady') {
    drawCoverKB(ctx, images[state.imageIndex], W, H, kbParams[state.imageIndex], state.progress);
    return;
  }

  // Transition
  const { fromIndex, toIndex, progress } = state;
  const fromImg = images[fromIndex];
  const toImg   = images[toIndex];

  switch (transitionType) {
    case 'fade': {
      // Crossfade — use KB at end/start states
      ctx.globalAlpha = 1 - progress;
      drawCoverKB(ctx, fromImg, W, H, kbParams[fromIndex], 1);
      ctx.globalAlpha = progress;
      drawCoverKB(ctx, toImg,   W, H, kbParams[toIndex],   0);
      ctx.globalAlpha = 1;
      break;
    }

    case 'slide-left': {
      // Both images slide left; from exits, to enters from right
      ctx.save();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.save();
      ctx.translate(-progress * W, 0);
      drawCover(ctx, fromImg, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - progress) * W, 0);
      drawCover(ctx, toImg, W, H);
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
      drawCover(ctx, fromImg, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - progress) * W, 0);
      drawCover(ctx, toImg, W, H);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'zoom-in': {
      // From fades at full size; to scales up (0.5 → 1.0) while fading in
      ctx.globalAlpha = 1 - progress;
      drawCover(ctx, fromImg, W, H);
      const s = 0.5 + 0.5 * progress;
      const { sx, sy, sw, sh } = coverRect(toImg.naturalWidth, toImg.naturalHeight, W, H);
      const dw = W * s;
      const dh = H * s;
      ctx.globalAlpha = progress;
      ctx.drawImage(toImg, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      break;
    }

    case 'zoom-out': {
      // To is at full size underneath; from shrinks (1.0 → 0.5) and fades out
      drawCover(ctx, toImg, W, H);
      const s = 1 - 0.5 * progress;
      const { sx, sy, sw, sh } = coverRect(fromImg.naturalWidth, fromImg.naturalHeight, W, H);
      const dw = W * s;
      const dh = H * s;
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

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  // Pre-generate Ken Burns params per image
  const kbParams = images.map(() =>
    config.kenBurns ? generateKenBurns() : null,
  );

  // Calculate total
  const totalDuration  = images.length * durationPerImage + (images.length - 1) * transitionDuration;
  const totalFrames    = Math.max(1, Math.round(totalDuration * fps));

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
      // Non-fatal: render without audio
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

  // Draw first frame to canvas before starting recorder (avoids blank first frame)
  drawFrame(ctx, config, kbParams, 0);

  recorder.start(500); // collect chunks every 500ms
  audio?.source.start(audio.audioCtx.currentTime);

  // Render loop — pace to real-time so captureStream captures each frame
  const frameMs    = 1000 / fps;
  const renderStart = performance.now();

  for (let frame = 0; frame < totalFrames; frame++) {
    drawFrame(ctx, config, kbParams, frame);

    onProgress({
      currentFrame: frame,
      totalFrames,
      percent: Math.round((frame / totalFrames) * 100),
    });

    // Wait until the next frame's target time
    const targetMs = renderStart + (frame + 1) * frameMs;
    const delay    = targetMs - performance.now();
    if (delay > 0) await new Promise<void>((r) => setTimeout(r, delay));
  }

  // Tear down
  try { audio?.source.stop(); } catch { /* already stopped */ }

  recorder.stop();
  videoStream.getTracks().forEach((t) => t.stop());

  await stopped;

  if (audio) await audio.audioCtx.close().catch(() => {});

  onProgress({ currentFrame: totalFrames, totalFrames, percent: 100 });

  return { blob: new Blob(chunks, { type: mimeType }), mimeType };
}
