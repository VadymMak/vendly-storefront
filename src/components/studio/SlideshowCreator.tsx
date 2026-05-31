'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  renderSlideshow,
  DEFAULT_SEQUENCE,
  type CameraMotion,
  type SlideshowItem,
  type TransitionType,
  type VideoStyle,
  type RenderProgress,
  type RenderResult,
} from '@/lib/slideshow-renderer';

// 'config' = upload + settings always visible; 'rendering' = progress; 'done' = result
type CreatorState = 'config' | 'rendering' | 'done';
type MotionChoice = 'auto' | CameraMotion;

interface SlideMedia {
  id: string;
  type: 'image' | 'video';
  file: File;
  objectUrl: string;
  element: HTMLImageElement | HTMLVideoElement;
  thumbnailDataUrl?: string; // first frame for video; images use objectUrl directly
  videoDuration?: number;    // seconds, only for video items
}

const OUTPUT_PRESETS = [
  { label: 'Square 1080×1080',       width: 1080, height: 1080 },
  { label: 'Reel / Story 1080×1920', width: 1080, height: 1920 },
  { label: 'Landscape 1920×1080',    width: 1920, height: 1080 },
] as const;

const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'fade',        label: 'Fade' },
  { id: 'slide-left',  label: 'Slide Left' },
  { id: 'slide-right', label: 'Slide Right' },
  { id: 'zoom-in',     label: 'Zoom In' },
  { id: 'zoom-out',    label: 'Zoom Out' },
];

const MOTION_OPTIONS: { value: MotionChoice; label: string }[] = [
  { value: 'auto',          label: 'Auto' },
  { value: 'zoom-in',       label: 'Zoom in' },
  { value: 'zoom-out',      label: 'Zoom out' },
  { value: 'pan-right',     label: 'Pan left → right' },
  { value: 'pan-left',      label: 'Pan right → left' },
  { value: 'pan-up',        label: 'Pan up' },
  { value: 'pan-down',      label: 'Pan down' },
  { value: 'diagonal-zoom', label: 'Diagonal zoom' },
];

const MOTION_SHORT: Record<CameraMotion, string> = {
  'zoom-in':       'zoom in',
  'zoom-out':      'zoom out',
  'pan-right':     'pan →',
  'pan-left':      '← pan',
  'pan-up':        'pan ↑',
  'pan-down':      'pan ↓',
  'diagonal-zoom': 'diagonal',
};

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

const STYLE_OPTIONS: { value: VideoStyle; labelKey: string }[] = [
  { value: 'none',         labelKey: 'styleNone' },
  { value: 'golden-hour', labelKey: 'styleGoldenHour' },
  { value: 'cinematic',   labelKey: 'styleCinematic' },
  { value: 'vintage',     labelKey: 'styleVintage' },
  { value: 'cool-tone',   labelKey: 'styleCoolTone' },
  { value: 'bw',          labelKey: 'styleBw' },
];

function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function loadImage(file: File): Promise<{ element: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img       = new Image();
    img.onload  = () => resolve({ element: img, objectUrl });
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Failed to load ${file.name}`)); };
    img.src     = objectUrl;
  });
}

function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = 128;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 128, 72);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

function loadVideo(
  file: File,
): Promise<{ element: HTMLVideoElement; objectUrl: string; duration: number; thumbnailDataUrl: string | null }> {
  return new Promise((resolve, reject) => {
    const objectUrl   = URL.createObjectURL(file);
    const video       = document.createElement('video');
    video.muted       = true;
    video.playsInline = true;
    video.preload     = 'auto';
    video.src         = objectUrl;

    video.addEventListener('loadedmetadata', () => {
      if (video.duration > 15) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Video must be 15 seconds or shorter'));
        return;
      }
      // Wait for enough data to decode the first frame
      video.addEventListener('canplay', () => {
        video.currentTime = 0;
        video.addEventListener('seeked', () => {
          resolve({ element: video, objectUrl, duration: video.duration, thumbnailDataUrl: captureVideoFrame(video) });
        }, { once: true });
      }, { once: true });
    }, { once: true });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load ${file.name}`));
    }, { once: true });

    video.load();
  });
}

function releaseVideoElement(video: HTMLVideoElement): void {
  video.src = '';
  video.load();
}

export default function SlideshowCreator() {
  const t = useTranslations('studio.slideshow');
  const [state, setState] = useState<CreatorState>('config');
  const [slides, setSlides] = useState<SlideMedia[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Settings
  const [transition, setTransition] = useState<TransitionType>('fade');
  const [durationPerImage, setDurationPerImage] = useState(4);
  const [transitionDuration, setTransitionDuration] = useState(0.8);
  const [cameraMotionEnabled, setCameraMotionEnabled] = useState(true);
  const [slideMotions, setSlideMotions] = useState<Record<string, MotionChoice>>({});
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('none');
  const [outputPresetIdx, setOutputPresetIdx] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Render
  const [progress, setProgress] = useState<RenderProgress>({ currentFrame: 0, totalFrames: 0, percent: 0, phase: 'rendering' });
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoUrlRef   = useRef<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Resolve effective motion for an image slide at global index idx
  const resolveMotion = (slideId: string, idx: number): CameraMotion =>
    (slideMotions[slideId] ?? 'auto') !== 'auto'
      ? (slideMotions[slideId] as CameraMotion)
      : DEFAULT_SEQUENCE[idx % DEFAULT_SEQUENCE.length];

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || VIDEO_TYPES.has(f.type),
    );
    if (!arr.length) return;

    const loaded: SlideMedia[] = [];
    for (const file of arr) {
      try {
        if (file.type.startsWith('image/')) {
          const { element, objectUrl } = await loadImage(file);
          loaded.push({ id: crypto.randomUUID(), type: 'image', file, objectUrl, element });
        } else {
          if (file.size > 50 * 1024 * 1024) {
            setError(`${file.name}: Video must be under 50 MB`);
            continue;
          }
          const { element, objectUrl, duration, thumbnailDataUrl } = await loadVideo(file);
          loaded.push({
            id: crypto.randomUUID(),
            type: 'video',
            file,
            objectUrl,
            element,
            thumbnailDataUrl: thumbnailDataUrl ?? undefined,
            videoDuration: duration,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load ${file.name}`);
      }
    }
    setSlides((prev) => [...prev, ...loaded].slice(0, 20));
  }, []);

  const removeSlide = (id: string) => {
    setSlides((prev) => {
      const slide = prev.find((s) => s.id === id);
      if (slide) {
        URL.revokeObjectURL(slide.objectUrl);
        if (slide.type === 'video') releaseVideoElement(slide.element as HTMLVideoElement);
      }
      return prev.filter((s) => s.id !== id);
    });
    setSlideMotions((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    setSlides((prev) => {
      const next   = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleAudioChange = (file: File) => {
    if (file.size > 20 * 1024 * 1024) { setError('Audio file must be under 20 MB'); return; }
    if (audioElement) URL.revokeObjectURL(audioElement.src);
    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioElement(new Audio(url));
  };

  const removeAudio = () => {
    if (audioElement) URL.revokeObjectURL(audioElement.src);
    setAudioFile(null);
    setAudioElement(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleRender = async () => {
    setState('rendering');
    setError(null);
    setProgress({ currentFrame: 0, totalFrames: 0, percent: 0, phase: 'rendering' });
    const preset = OUTPUT_PRESETS[outputPresetIdx];

    const items: SlideshowItem[] = slides.map((s, i) => {
      if (s.type === 'video') {
        const video  = s.element as HTMLVideoElement;
        video.muted  = true;
        return { type: 'video' as const, element: video, duration: s.videoDuration ?? 5 };
      }
      return {
        type:     'image' as const,
        element:  s.element as HTMLImageElement,
        duration: durationPerImage,
        motion:   cameraMotionEnabled ? resolveMotion(s.id, i) : undefined,
      };
    });

    try {
      const r = await renderSlideshow(
        {
          items,
          transitionDuration,
          transitionType: transition,
          outputSize: { width: preset.width, height: preset.height },
          fps: 30,
          audioFile: audioFile ?? undefined,
          style: videoStyle,
        },
        setProgress,
      );
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = URL.createObjectURL(r.blob);
      setResult(r);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed. Try Chrome for best compatibility.');
      setState('config');
    }
  };

  const resetAll = () => {
    slides.forEach((s) => {
      URL.revokeObjectURL(s.objectUrl);
      if (s.type === 'video') releaseVideoElement(s.element as HTMLVideoElement);
    });
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = null; }
    if (audioElement) URL.revokeObjectURL(audioElement.src);
    setSlides([]);
    setSlideMotions({});
    setResult(null);
    setError(null);
    setAudioFile(null);
    setAudioElement(null);
    setState('config');
  };

  // Total slideshow duration with per-item durations
  const totalSec = slides.length < 1 ? 0 : +(Math.max(0,
    slides.reduce((sum, s) => sum + (s.videoDuration ?? durationPerImage), 0) -
    Math.max(0, slides.length - 1) * transitionDuration,
  )).toFixed(1);

  // ── Rendering ─────────────────────────────────────────────────────────────────

  if (state === 'rendering') {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8">
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--color-border)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-primary)]" />
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--color-primary)]">
              {progress.percent}%
            </div>
          </div>
          <div>
            <div className="text-base font-semibold">
              {progress.phase === 'audio' ? 'Adding music…' : 'Rendering your slideshow…'}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-dim)]">
              {progress.phase === 'audio'
                ? 'Syncing audio in real-time — almost done'
                : `Frame ${progress.currentFrame} of ${progress.totalFrames} · ${totalSec}s video`}
            </div>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">
            Rendering happens in your browser at real-time speed — do not close this tab
          </p>
        </div>
      </section>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  if (state === 'done' && result && videoUrlRef.current) {
    const ext = result.mimeType.includes('mp4') ? 'mp4' : 'webm';
    return (
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your Slideshow is Ready</h2>
          <button onClick={resetAll} className="cursor-pointer text-xs text-[var(--color-text-dim)] hover:text-white">
            Start over
          </button>
        </div>
        <video src={videoUrlRef.current} controls autoPlay loop className="w-full rounded-lg" />
        <div className="flex gap-3">
          <a
            href={videoUrlRef.current}
            download={`slideshow.${ext}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download {ext.toUpperCase()}
          </a>
          <button
            onClick={() => setState('config')}
            className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white"
          >
            Re-render
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-dim)]">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {result.mimeType.includes('mp4')
            ? 'H.264 MP4 · ready for Instagram, TikTok, YouTube'
            : 'WebM · Chrome/Firefox compatible · convert to MP4 with HandBrake if needed'}
        </div>
      </section>
    );
  }

  // ── Config (upload + settings always visible) ─────────────────────────────────

  const preset = OUTPUT_PRESETS[outputPresetIdx];

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ── Media upload / timeline ── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Photo &amp; Video Slideshow</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-dim)]">
              Rendered in your browser · No credits needed
            </p>
          </div>
          {slides.length > 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline"
            >
              + Add more
            </button>
          )}
        </div>

        {/* Drop zone — shown when no media yet */}
        {slides.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
              isDragOver
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50',
            )}
          >
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-dim)]" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="text-center">
              <div className="font-semibold text-[var(--color-text-muted)]">Drop images or videos here or click to upload</div>
              <div className="mt-1 text-xs text-[var(--color-text-dim)]">JPG, PNG, WebP, MP4 — up to 20 files</div>
            </div>
          </div>
        )}

        {/* Timeline with per-slide controls */}
        {slides.length > 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cx(
              'space-y-2 rounded-xl border-2 border-dashed p-3 transition-colors',
              isDragOver
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-transparent',
            )}
          >
            {slides.map((s, idx) => {
              const isVideo    = s.type === 'video';
              const choice     = slideMotions[s.id] ?? 'auto';
              const autoMotion = DEFAULT_SEQUENCE[idx % DEFAULT_SEQUENCE.length];

              return (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                  <span className="w-5 shrink-0 text-center text-xs text-[var(--color-text-dim)]">{idx + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={isVideo ? (s.thumbnailDataUrl ?? s.objectUrl) : s.objectUrl}
                    alt={`Slide ${idx + 1}`}
                    className="h-12 w-16 shrink-0 rounded object-cover"
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs text-[var(--color-text-dim)]">{s.file.name}</span>
                      {isVideo && (
                        <span className="shrink-0 rounded bg-[var(--color-primary)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
                          ▶ {s.videoDuration?.toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {/* Camera motion dropdown — images only */}
                    {!isVideo && cameraMotionEnabled && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={choice}
                          onChange={(e) => setSlideMotions((prev) => ({ ...prev, [s.id]: e.target.value as MotionChoice }))}
                          className="cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                        >
                          {MOTION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {choice === 'auto' && (
                          <span className="text-[11px] text-[var(--color-text-dim)]">
                            ({MOTION_SHORT[autoMotion]})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveSlide(idx, -1)}
                      className="cursor-pointer rounded p-1 text-[var(--color-text-dim)] hover:text-white disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button
                      disabled={idx === slides.length - 1}
                      onClick={() => moveSlide(idx, 1)}
                      className="cursor-pointer rounded p-1 text-[var(--color-text-dim)] hover:text-white disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    <button
                      onClick={() => removeSlide(s.id)}
                      className="cursor-pointer rounded p-1 text-red-400/60 hover:text-red-400"
                      aria-label="Remove"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="px-1 pt-1 text-xs text-[var(--color-text-dim)]">
              {slides.length} item{slides.length !== 1 ? 's' : ''} · {totalSec}s total
              {slides.length < 2 && (
                <span className="ml-2 text-amber-400">— add at least 2 items to render</span>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void addFiles(e.target.files)}
        />
      </section>

      {/* ── Settings ── always visible ── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-5 text-base font-semibold">Settings</h2>
        <div className="space-y-6">

          {/* Output size */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">Output Size</label>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setOutputPresetIdx(i)}
                  className={cx(
                    'cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    outputPresetIdx === i
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-white',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background music */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">
              Background music{' '}
              <span className="text-xs font-normal text-[var(--color-text-dim)]">(optional · max 20 MB · Chrome only)</span>
            </label>
            {audioFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-primary)]" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                <span className="flex-1 truncate text-sm text-[var(--color-text-muted)]">{audioFile.name}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-dim)]">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>
                <button onClick={removeAudio} className="cursor-pointer text-[var(--color-text-dim)] transition-colors hover:text-red-400" aria-label="Remove audio">
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => audioInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text-muted)]"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                Upload MP3, WAV, OGG or M4A
              </button>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioChange(f); }}
            />
            {audioFile && (
              <p className="mt-1.5 text-xs text-[var(--color-text-dim)]">
                Auto-trims to video length · fades out last 2 seconds · requires Chrome for MP4 · video audio is always muted
              </p>
            )}
            <a href="https://pixabay.com/music/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] text-[var(--color-primary)] hover:underline">
              Find free music on Pixabay →
            </a>
          </div>

          {/* Transition */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">Transition</label>
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTransition(id)}
                  className={cx(
                    'cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    transition === id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration per photo */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-muted)]">Duration per photo</label>
              <span className="text-sm font-semibold text-white">{durationPerImage}s</span>
            </div>
            <input
              type="range" min={3} max={8} step={0.5}
              value={durationPerImage}
              onChange={(e) => setDurationPerImage(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--color-text-dim)]">
              <span>3s (faster)</span><span>8s (slower)</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-dim)]">Videos use their natural duration (max 15s)</p>
          </div>

          {/* Transition duration */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-muted)]">Transition duration</label>
              <span className="text-sm font-semibold text-white">{transitionDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range" min={0.5} max={1.5} step={0.1}
              value={transitionDuration}
              onChange={(e) => setTransitionDuration(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--color-text-dim)]">
              <span>0.5s</span><span>1.5s</span>
            </div>
          </div>

          {/* Camera motion toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-muted)]">Camera motion</div>
              <div className="text-xs text-[var(--color-text-dim)]">
                {cameraMotionEnabled
                  ? 'Instagram-style zoom & pan — set per photo above · videos play as-is'
                  : 'Disabled — photos shown static · videos play as-is'}
              </div>
            </div>
            <button
              onClick={() => setCameraMotionEnabled((v) => !v)}
              role="switch"
              aria-checked={cameraMotionEnabled}
              className={cx(
                'relative h-6 w-11 cursor-pointer rounded-full transition-colors',
                cameraMotionEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]',
              )}
            >
              <span
                className={cx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left]',
                  cameraMotionEnabled ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          {/* Visual style */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">{t('style')}</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setVideoStyle(value)}
                  className={cx(
                    'cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    videoStyle === value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-white',
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── Render CTA ── */}
      <button
        onClick={() => void handleRender()}
        disabled={slides.length < 2}
        className="w-full cursor-pointer rounded-lg bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {slides.length < 2
          ? 'Upload at least 2 photos or videos to render'
          : `Render Slideshow — ${slides.length} items · ${preset.width}×${preset.height} · ${totalSec}s →`}
      </button>

      <p className="text-center text-xs text-[var(--color-text-dim)]">
        Rendered locally in your browser · No credits used · No data uploaded to our servers
      </p>
    </div>
  );
}
