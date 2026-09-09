'use client';

import { useState, useEffect, useRef } from 'react';
import { getAssembleItems, clearAssembleItems } from '@/lib/studio/media-context';
import { renderSlideshow, DEFAULT_SEQUENCE } from '@/lib/slideshow-renderer';
import type { SlideshowItem, SlideshowConfig, TransitionType } from '@/lib/slideshow-renderer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  duration: number;
  prompt?: string;
}

type AspectRatio = '9:16' | '1:1' | '16:9';

// ── Constants ─────────────────────────────────────────────────────────────────

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '9:16':  { width: 1080, height: 1920 },
  '1:1':   { width: 1080, height: 1080 },
  '16:9':  { width: 1920, height: 1080 },
};

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'fade',        label: 'Fade' },
  { value: 'slide-left',  label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'zoom-in',     label: 'Zoom In' },
  { value: 'zoom-out',    label: 'Zoom Out' },
];

const TRANSITION_DUR = 0.5;
const FPS = 30;
const IMAGE_DUR_OPTIONS = [2, 3, 4, 5];

// ── Helpers ───────────────────────────────────────────────────────────────────

function videoDurationOf(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => resolve(isFinite(v.duration) && v.duration > 0 ? v.duration : 5);
    v.onerror = () => resolve(5);
  });
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadVid(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = reject;
    v.load();
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  );
}

function IconFilm() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
}

export function AssembleCanvas({ userId: _userId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [transition, setTransition] = useState<TransitionType>('fade');
  const [imageDuration, setImageDuration] = useState(3);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderPhase, setRenderPhase] = useState<'rendering' | 'audio'>('rendering');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState('video/mp4');
  const [projectName, setProjectName] = useState('Untitled Clip');
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef  = useRef<HTMLInputElement>(null);
  const resultBlobRef = useRef<string | null>(null);

  // Cleanup result blob URL on unmount
  useEffect(() => {
    return () => { if (resultBlobRef.current) URL.revokeObjectURL(resultBlobRef.current); };
  }, []);

  // Load items from pipeline (sessionStorage) on mount
  useEffect(() => {
    const pipelineItems = getAssembleItems();
    if (pipelineItems.length > 0) {
      setItems(pipelineItems.map(item => ({
        id: item.id,
        type: item.type,
        url: item.url,
        duration: item.duration ?? (item.type === 'video' ? 5 : 3),
        prompt: item.prompt,
      })));
      clearAssembleItems();
    }
  }, []);

  const totalDuration = Math.max(
    0,
    items.reduce((s, i) => s + i.duration, 0) - Math.max(0, items.length - 1) * TRANSITION_DUR,
  );

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFileAdd(files: FileList | File[]) {
    const arr = Array.from(files);
    const newItems: TimelineItem[] = [];
    for (const file of arr) {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      const duration = isVideo ? await videoDurationOf(url) : imageDuration;
      newItems.push({ id: crypto.randomUUID(), type: isVideo ? 'video' : 'image', url, file, duration });
    }
    setItems(prev => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(item => item.id !== id));
  }

  function applyImageDuration(dur: number) {
    setImageDuration(dur);
    setItems(prev => prev.map(item => item.type === 'image' ? { ...item, duration: dur } : item));
  }

  // ── Drag & drop reorder ────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    const dragIdx = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(dragIdx) || dragIdx === dropIdx) { setDragOverIdx(null); return; }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setDragOverIdx(null);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (items.length < 2) { setError('Add at least 2 clips to export'); return; }
    setError(null);
    setIsRendering(true);
    setRenderProgress(0);

    if (resultBlobRef.current) { URL.revokeObjectURL(resultBlobRef.current); resultBlobRef.current = null; }
    setResultUrl(null);

    try {
      const slideshowItems: SlideshowItem[] = await Promise.all(
        items.map(async (item, idx) => {
          if (item.type === 'video') {
            const el = await loadVid(item.url);
            return { type: 'video' as const, element: el, duration: item.duration };
          }
          const el = await loadImg(item.url);
          return {
            type: 'image' as const,
            element: el,
            duration: item.duration,
            motion: DEFAULT_SEQUENCE[idx % DEFAULT_SEQUENCE.length],
          };
        })
      );

      const config: SlideshowConfig = {
        items: slideshowItems,
        transitionDuration: TRANSITION_DUR,
        transitionType: transition,
        outputSize: ASPECT_SIZES[aspectRatio],
        fps: FPS,
        musicFile: musicFile ?? undefined,
      };

      const result = await renderSlideshow(config, (progress) => {
        setRenderProgress(progress.percent);
        setRenderPhase(progress.phase);
      });

      const url = URL.createObjectURL(result.blob);
      resultBlobRef.current = url;
      setResultUrl(url);
      setResultMime(result.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setIsRendering(false);
    }
  }

  function handleDownload() {
    if (!resultUrl) return;
    const ext = resultMime.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
  }

  function handleStartOver() {
    if (resultBlobRef.current) { URL.revokeObjectURL(resultBlobRef.current); resultBlobRef.current = null; }
    setResultUrl(null);
    setRenderProgress(0);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">

      {/* ── Header ── */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              autoFocus
              className="min-w-0 max-w-[180px] rounded bg-white/10 px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="truncate text-sm font-medium text-white hover:text-gray-300"
              title="Click to rename"
            >
              {projectName}
            </button>
          )}
          {items.length > 0 && (
            <span className="flex-shrink-0 text-xs text-gray-600">{totalDuration.toFixed(1)}s</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(['9:16', '1:1', '16:9'] as const).map(ar => (
            <button
              key={ar}
              onClick={() => setAspectRatio(ar)}
              className={[
                'rounded px-2.5 py-1 text-xs transition-colors',
                aspectRatio === ar ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {ar}
            </button>
          ))}
        </div>

        <button
          onClick={() => void handleExport()}
          disabled={isRendering || items.length < 2}
          className="flex-shrink-0 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRendering ? `${renderProgress}%` : 'Export'}
        </button>
      </div>

      {/* ── Preview ── */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 p-6">
        {resultUrl ? (
          <div className="flex flex-col items-center gap-5">
            <video
              src={resultUrl}
              controls
              loop
              className="max-h-[55vh] max-w-full rounded-xl object-contain"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                <IconDownload /> Download MP4
              </button>
              <button
                onClick={handleStartOver}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:border-white/20 hover:text-white"
              >
                <IconRefresh /> Start over
              </button>
            </div>
          </div>
        ) : isRendering ? (
          <div className="flex w-full max-w-xs flex-col items-center gap-4">
            <p className="text-sm font-medium text-white">
              {renderPhase === 'audio' ? 'Adding music…' : 'Rendering…'}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{renderProgress}%</p>
          </div>
        ) : items.length > 0 ? (
          <div className="relative">
            {items[0].type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={items[0].url}
                alt="Preview"
                className="max-h-[55vh] max-w-full rounded-xl object-contain opacity-80"
              />
            ) : (
              <video
                src={items[0].url}
                className="max-h-[55vh] max-w-full rounded-xl object-contain opacity-80"
                muted
                playsInline
              />
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs text-gray-400">
              {items.length} {items.length === 1 ? 'clip' : 'clips'} · {totalDuration.toFixed(1)}s
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 px-12 py-10 text-gray-600"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void handleFileAdd(e.dataTransfer.files);
            }}
          >
            <IconFilm />
            <p className="text-sm">Drop images or videos here</p>
            <p className="text-xs text-gray-700">or add clips from the timeline below</p>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="flex-shrink-0 border-t border-white/10 bg-[#0d0d14]">

        {/* Clips row */}
        <div
          className="flex items-center gap-1 overflow-x-auto px-3 py-3"
          style={{ scrollbarWidth: 'thin' }}
        >
          {items.map((item, idx) => (
            <div key={item.id} className="flex flex-shrink-0 items-center">
              {/* Drop highlight bar */}
              <div
                className={[
                  'flex-shrink-0 h-[68px] rounded transition-all duration-100',
                  dragOverIdx === idx ? 'w-1 bg-green-500 mr-1' : 'w-0',
                ].join(' ')}
              />

              {/* Clip card */}
              <div
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragLeave={() => setDragOverIdx(null)}
                onDragEnd={() => setDragOverIdx(null)}
                className={[
                  'group relative flex-shrink-0 h-[68px] w-[108px] cursor-grab overflow-hidden rounded-lg border transition-colors active:cursor-grabbing',
                  dragOverIdx === idx ? 'border-green-500/50' : 'border-white/10 hover:border-white/25',
                ].join(' ')}
              >
                {item.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                )}

                <div className="absolute bottom-1 left-1 rounded bg-black/75 px-1 py-px text-[10px] leading-tight text-white">
                  {item.duration.toFixed(1)}s
                </div>

                {item.type === 'video' && (
                  <div className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[9px] text-gray-300">▶</div>
                )}

                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute right-1 top-1 hidden rounded-full bg-black/75 p-0.5 text-white hover:bg-black group-hover:flex"
                  title="Remove clip"
                >
                  <IconX size={11} />
                </button>
              </div>

              {/* Transition arrow */}
              {idx < items.length - 1 && (
                <span className="flex-shrink-0 px-1 text-[10px] text-gray-700">→</span>
              )}
            </div>
          ))}

          {/* Add clip */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-gray-600 transition-colors hover:border-white/25 hover:text-gray-400"
          >
            <IconPlus />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => { if (e.target.files) void handleFileAdd(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Music row */}
        <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2">
          <span className="text-gray-600"><IconMusic /></span>
          {musicFile ? (
            <>
              <div className="flex-1 truncate rounded bg-white/5 px-2.5 py-1.5 text-xs text-gray-300">
                <span className="text-green-500">♪</span> {musicFile.name}
              </div>
              <button
                onClick={() => { setMusicFile(null); if (musicInputRef.current) musicInputRef.current.value = ''; }}
                className="text-xs text-gray-600 hover:text-gray-400"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={() => musicInputRef.current?.click()}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              Add music (MP3, WAV)
            </button>
          )}
          <input
            ref={musicInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setMusicFile(f); }}
          />
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Transition</span>
            <select
              value={transition}
              onChange={e => setTransition(e.target.value as TransitionType)}
              className="rounded bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-green-600"
            >
              {TRANSITION_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Image duration</span>
            <div className="flex gap-1">
              {IMAGE_DUR_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => applyImageDuration(d)}
                  className={[
                    'rounded px-2 py-1 text-xs transition-colors',
                    imageDuration === d ? 'bg-green-600/20 text-green-400' : 'text-gray-600 hover:text-gray-300',
                  ].join(' ')}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/90 px-4 py-3 text-sm text-red-300 shadow-xl">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300">
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
