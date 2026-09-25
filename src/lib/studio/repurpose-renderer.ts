'use client';

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface RepurposeTarget {
  id: string;
  label: string;
  aspectRatio: string;
  width: number;
  height: number;
  maxDuration?: number;
}

export interface RepurposeProgress {
  targetId: string;
  percent: number;
  phase: 'decoding' | 'encoding' | 'done' | 'error';
  error?: string;
}

export interface RepurposeResult {
  targetId: string;
  label: string;
  blob: Blob;
  width: number;
  height: number;
  sizeMB: number;
  filename: string;
}

export const REPURPOSE_TARGETS: RepurposeTarget[] = [
  { id: 'ig-reel',   label: 'Instagram Reel',   aspectRatio: '9:16',  width: 1080, height: 1920, maxDuration: 90 },
  { id: 'ig-story',  label: 'Instagram Story',   aspectRatio: '9:16',  width: 1080, height: 1920, maxDuration: 15 },
  { id: 'tiktok',    label: 'TikTok',            aspectRatio: '9:16',  width: 1080, height: 1920, maxDuration: 60 },
  { id: 'yt-short',  label: 'YouTube Short',     aspectRatio: '9:16',  width: 1080, height: 1920, maxDuration: 60 },
  { id: 'fb-reel',   label: 'Facebook Reel',     aspectRatio: '9:16',  width: 1080, height: 1920, maxDuration: 90 },
  { id: 'landscape', label: 'Landscape (16:9)',  aspectRatio: '16:9',  width: 1920, height: 1080 },
  { id: 'square',    label: 'Square (1:1)',       aspectRatio: '1:1',   width: 1080, height: 1080 },
];

// Center-crop: returns the source region that fills the destination aspect ratio
function getCropTransform(
  srcW: number, srcH: number,
  dstW: number, dstH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    // Source is wider — crop sides, keep center vertical strip
    const cropW = srcH * dstAspect;
    return { sx: (srcW - cropW) / 2, sy: 0, sw: cropW, sh: srcH };
  } else {
    // Source is taller — crop top/bottom, keep center horizontal strip
    const cropH = srcW / dstAspect;
    return { sx: 0, sy: (srcH - cropH) / 2, sw: srcW, sh: cropH };
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

async function loadVideoMeta(video: HTMLVideoElement, src: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => {
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    }, { once: true });
    video.addEventListener('error', () => reject(new Error('Failed to load video')), { once: true });
    video.src = src;
    video.load();
  });
}

async function encodeTargetWebCodecs(
  video: HTMLVideoElement,
  target: RepurposeTarget,
  srcW: number,
  srcH: number,
  duration: number,
  fps: number,
  baseName: string,
  onProgress: (p: RepurposeProgress) => void,
): Promise<RepurposeResult> {
  const { id, label, width: dstW, height: dstH } = target;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  const crop = getCropTransform(srcW, srcH, dstW, dstH);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const arrayTarget = new ArrayBufferTarget();
  const muxer = new Muxer({ target: arrayTarget, video: { codec: 'avc', width: dstW, height: dstH }, fastStart: 'in-memory' });

  const codecCandidates = ['avc1.640028', 'avc1.4d0028', 'avc1.42E01E', 'avc1.42001f'];
  let selectedCodec: string | null = null;
  for (const codec of codecCandidates) {
    const support = await VideoEncoder.isConfigSupported({ codec, width: dstW, height: dstH, bitrate: 6_000_000, framerate: fps });
    if (support.supported) { selectedCodec = codec; break; }
  }
  if (!selectedCodec) throw new Error('No supported H.264 encoder');

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? {}),
    error: (e) => console.error('[Repurpose] Encoder error:', e),
  });
  encoder.configure({ codec: selectedCodec, width: dstW, height: dstH, bitrate: 6_000_000, framerate: fps });

  const MAX_QUEUE = 20;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    if (Math.abs(video.currentTime - t) > 0.02) {
      await seekVideo(video, t);
    }

    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dstW, dstH);
    const videoFrame = new VideoFrame(canvas, { timestamp: frame * frameDurationUs });

    while (encoder.encodeQueueSize >= MAX_QUEUE) {
      await new Promise<void>(r => encoder.addEventListener('dequeue', () => r(), { once: true }));
    }

    encoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    videoFrame.close();

    const percent = Math.round((frame / totalFrames) * 95);
    onProgress({ targetId: id, percent, phase: 'encoding' });
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const blob = new Blob([arrayTarget.buffer], { type: 'video/mp4' });
  onProgress({ targetId: id, percent: 100, phase: 'done' });

  return {
    targetId: id,
    label,
    blob,
    width: dstW,
    height: dstH,
    sizeMB: Math.round((blob.size / (1024 * 1024)) * 10) / 10,
    filename: `${baseName}_${id}_${dstW}x${dstH}.mp4`,
  };
}

async function encodeTargetMediaRecorder(
  video: HTMLVideoElement,
  target: RepurposeTarget,
  srcW: number,
  srcH: number,
  duration: number,
  fps: number,
  baseName: string,
  onProgress: (p: RepurposeProgress) => void,
): Promise<RepurposeResult> {
  const { id, label, width: dstW, height: dstH } = target;
  const crop = getCropTransform(srcW, srcH, dstW, dstH);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const mimeType = ['video/webm; codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise<void>(r => { recorder.onstop = () => r(); });
  recorder.start();

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameInterval = 1000 / fps;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    if (Math.abs(video.currentTime - t) > 0.02) {
      await seekVideo(video, t);
    }

    const frameStart = performance.now();
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dstW, dstH);

    onProgress({ targetId: id, percent: Math.round((frame / totalFrames) * 95), phase: 'encoding' });

    const elapsed = performance.now() - frameStart;
    const wait = Math.max(0, frameInterval - elapsed);
    if (wait > 0) await new Promise<void>(r => setTimeout(r, wait));
  }

  recorder.stop();
  stream.getTracks().forEach(t => t.stop());
  await stopped;

  const blob = new Blob(chunks, { type: mimeType });
  onProgress({ targetId: id, percent: 100, phase: 'done' });

  return {
    targetId: id,
    label,
    blob,
    width: dstW,
    height: dstH,
    sizeMB: Math.round((blob.size / (1024 * 1024)) * 10) / 10,
    filename: `${baseName}_${id}_${dstW}x${dstH}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`,
  };
}

export async function repurposeVideo(
  sourceBlob: Blob,
  targets: RepurposeTarget[],
  baseName: string,
  onProgress: (p: RepurposeProgress) => void,
): Promise<RepurposeResult[]> {
  if (targets.length === 0) return [];

  const sourceUrl = URL.createObjectURL(sourceBlob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  let srcW = 0;
  let srcH = 0;
  let duration = 0;

  try {
    const meta = await loadVideoMeta(video, sourceUrl);
    srcW = meta.width;
    srcH = meta.height;
    duration = meta.duration;
  } catch (e) {
    URL.revokeObjectURL(sourceUrl);
    throw e;
  }

  const fps = 30;
  const results: RepurposeResult[] = [];
  const webCodecsAvailable = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

  for (const target of targets) {
    onProgress({ targetId: target.id, percent: 0, phase: 'decoding' });
    try {
      // Clamp duration to target max if applicable
      const effectiveDuration = target.maxDuration ? Math.min(duration, target.maxDuration) : duration;

      // Re-use same video element; seek to start
      await seekVideo(video, 0);

      const result = webCodecsAvailable
        ? await encodeTargetWebCodecs(video, target, srcW, srcH, effectiveDuration, fps, baseName, onProgress)
        : await encodeTargetMediaRecorder(video, target, srcW, srcH, effectiveDuration, fps, baseName, onProgress);

      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ targetId: target.id, percent: 0, phase: 'error', error: message });
    }
  }

  URL.revokeObjectURL(sourceUrl);
  video.src = '';
  return results;
}
