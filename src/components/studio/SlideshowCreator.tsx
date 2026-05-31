'use client';

import { useState, useRef, useCallback } from 'react';
import {
  renderSlideshow,
  type TransitionType,
  type RenderProgress,
  type RenderResult,
} from '@/lib/slideshow-renderer';

type CreatorState = 'idle' | 'preview' | 'rendering' | 'done';

interface SlideImage {
  id: string;
  file: File;
  objectUrl: string;
  element: HTMLImageElement;
}

const OUTPUT_PRESETS = [
  { label: 'Square 1080×1080',      width: 1080, height: 1080 },
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

function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function loadImage(file: File): Promise<{ element: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ element: img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load ${file.name}`));
    };
    img.src = objectUrl;
  });
}

export default function SlideshowCreator() {
  const [state, setState] = useState<CreatorState>('idle');
  const [slides, setSlides] = useState<SlideImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Settings
  const [transition, setTransition] = useState<TransitionType>('fade');
  const [durationPerImage, setDurationPerImage] = useState(4);
  const [transitionDuration, setTransitionDuration] = useState(0.8);
  const [kenBurns, setKenBurns] = useState(true);
  const [outputPresetIdx, setOutputPresetIdx] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Render
  const [progress, setProgress] = useState<RenderProgress>({ currentFrame: 0, totalFrames: 0, percent: 0 });
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    const loaded: SlideImage[] = [];
    for (const file of arr) {
      try {
        const { element, objectUrl } = await loadImage(file);
        loaded.push({ id: crypto.randomUUID(), file, objectUrl, element });
      } catch {
        // skip unreadable files
      }
    }
    setSlides((prev) => [...prev, ...loaded].slice(0, 20));
  }, []);

  const removeSlide = (id: string) => {
    setSlides((prev) => {
      const slide = prev.find((s) => s.id === id);
      if (slide) URL.revokeObjectURL(slide.objectUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    setSlides((prev) => {
      const next = [...prev];
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

  const handleRender = async () => {
    setState('rendering');
    setError(null);
    setProgress({ currentFrame: 0, totalFrames: 0, percent: 0 });
    const preset = OUTPUT_PRESETS[outputPresetIdx];
    try {
      const r = await renderSlideshow(
        {
          images: slides.map((s) => s.element),
          durationPerImage,
          transitionDuration,
          transitionType: transition,
          kenBurns,
          outputSize: { width: preset.width, height: preset.height },
          fps: 30,
          audioFile: audioFile ?? undefined,
        },
        setProgress,
      );
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = URL.createObjectURL(r.blob);
      setResult(r);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed. Try Chrome for best compatibility.');
      setState('preview');
    }
  };

  const resetAll = () => {
    slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setSlides([]);
    setResult(null);
    setError(null);
    setAudioFile(null);
    setState('idle');
  };

  const totalSec = +(slides.length * durationPerImage + Math.max(0, slides.length - 1) * transitionDuration).toFixed(1);

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
            <div className="text-base font-semibold">Rendering your slideshow…</div>
            <div className="mt-1 text-xs text-[var(--color-text-dim)]">
              Frame {progress.currentFrame} of {progress.totalFrames} · {totalSec}s video
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
            onClick={() => setState('preview')}
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

  // ── Idle ──────────────────────────────────────────────────────────────────────

  if (state === 'idle') {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-1 text-base font-semibold">Photo Slideshow Creator</h2>
          <p className="mb-5 text-sm text-[var(--color-text-muted)]">
            Turn your photos into a smooth MP4 slideshow with transitions and Ken Burns effects — rendered entirely in your
            browser. No credits needed.
          </p>

          {/* Drop zone */}
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
              <div className="font-semibold text-[var(--color-text-muted)]">Drop images here or click to upload</div>
              <div className="mt-1 text-xs text-[var(--color-text-dim)]">JPG, PNG, WebP — up to 20 photos</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </div>

          {slides.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-text-muted)]">
                  {slides.length} photo{slides.length !== 1 ? 's' : ''} added
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline"
                >
                  + Add more
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {slides.map((s, idx) => (
                  <div key={s.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.objectUrl} alt={`Slide ${idx + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }}
                      className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              {slides.length >= 2 ? (
                <button
                  onClick={() => setState('preview')}
                  className="w-full cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
                >
                  Configure & Create Slideshow →
                </button>
              ) : (
                <p className="text-center text-xs text-[var(--color-text-dim)]">Add at least 2 photos to continue</p>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Preview / Settings ────────────────────────────────────────────────────────

  const preset = OUTPUT_PRESETS[outputPresetIdx];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Timeline */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Slideshow Timeline</h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setState('idle')} className="cursor-pointer text-xs text-[var(--color-text-dim)] hover:text-white">
              ← Back
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline"
            >
              + Add photos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </div>
        </div>

        <div className="space-y-2">
          {slides.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
              <span className="w-5 shrink-0 text-center text-xs text-[var(--color-text-dim)]">{idx + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.objectUrl} alt={`Slide ${idx + 1}`} className="h-12 w-20 shrink-0 rounded object-cover" />
              <div className="flex-1 truncate text-xs text-[var(--color-text-dim)]">{s.file.name}</div>
              <div className="flex items-center gap-1">
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
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-[var(--color-bg)] px-4 py-3 text-xs text-[var(--color-text-dim)]">
          Total:{' '}
          <span className="font-semibold text-[var(--color-text-muted)]">{totalSec}s</span>
          {' '}· {slides.length} photos · {slides.length - 1} transition{slides.length - 1 !== 1 ? 's' : ''}
        </div>
      </section>

      {/* Settings */}
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

          {/* Duration per image */}
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

          {/* Ken Burns toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-muted)]">Ken Burns effect</div>
              <div className="text-xs text-[var(--color-text-dim)]">Subtle zoom and pan per photo</div>
            </div>
            <button
              onClick={() => setKenBurns((v) => !v)}
              role="switch"
              aria-checked={kenBurns}
              className={cx(
                'relative h-6 w-11 cursor-pointer rounded-full transition-colors',
                kenBurns ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]',
              )}
            >
              <span
                className={cx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left]',
                  kenBurns ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          {/* Audio */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-muted)]">
              Background music{' '}
              <span className="text-xs font-normal text-[var(--color-text-dim)]">(optional, Chrome only)</span>
            </label>
            {audioFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-primary)]" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                <span className="flex-1 truncate text-sm text-[var(--color-text-muted)]">{audioFile.name}</span>
                <button onClick={() => setAudioFile(null)} className="cursor-pointer text-xs text-red-400 hover:text-red-300">
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => audioInputRef.current?.click()}
                className="cursor-pointer rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text-muted)]"
              >
                + Upload MP3 / audio file
              </button>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
            {audioFile && (
              <p className="mt-1.5 text-xs text-[var(--color-text-dim)]">
                Audio fades out in the last 2 seconds. Muted in WebM fallback on Safari.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Render CTA */}
      <button
        onClick={() => void handleRender()}
        disabled={slides.length < 2}
        className="w-full cursor-pointer rounded-lg bg-[var(--color-primary)] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
      >
        Render Slideshow — {slides.length} photos · {preset.width}×{preset.height} · {totalSec}s →
      </button>

      <p className="text-center text-xs text-[var(--color-text-dim)]">
        Rendered locally in your browser · No credits used · No data uploaded to our servers
      </p>
    </div>
  );
}
