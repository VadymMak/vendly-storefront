'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import type { TimelineClip, TimelineTrack, MediaItem } from '@/lib/studio/store';
import type { TextOverlay } from '@/lib/slideshow-renderer';
import { urlToDataUrl } from '@/lib/studio/media-utils';
import { useHistoryStore } from '@/lib/studio/history';
import {
  removeClipWithHistory,
  splitClipWithHistory,
  trimClipWithHistory,
  duplicateClipWithHistory,
} from '@/lib/studio/history-commands';


// ── Constants ─────────────────────────────────────────────────────────────────

const HEADER_W = 100;
const MIN_DUR   = 0.1;

function snap(t: number): number {
  return Math.round(t * 10) / 10;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DragKind = 'move' | 'trim-l' | 'trim-r' | 'playhead';

interface DragState {
  kind: DragKind;
  clipId?: string;
  startX: number;
  origStart: number;
  origDur: number;
}

interface DraftClip {
  id: string;
  startTime: number;
  duration: number;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconFilm() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
    </svg>
  );
}

function IconText() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Track color helpers ───────────────────────────────────────────────────────

function trackIcon(type: TimelineTrack['type']) {
  if (type === 'video') return <IconFilm />;
  if (type === 'text')  return <IconText />;
  return <IconMusic />;
}

function clipBg(type: TimelineClip['type'], selected: boolean): string {
  if (selected) {
    if (type === 'video' || type === 'image') return 'bg-blue-500/70 border-blue-400 ring-1 ring-blue-400';
    if (type === 'text')  return 'bg-purple-500/70 border-purple-400 ring-1 ring-purple-400';
    return 'bg-green-500/70 border-green-400 ring-1 ring-green-400';
  }
  if (type === 'video' || type === 'image') return 'bg-blue-700/50 border-blue-500/50 hover:bg-blue-700/60';
  if (type === 'text')  return 'bg-purple-700/50 border-purple-500/50 hover:bg-purple-700/60';
  return 'bg-green-700/50 border-green-500/50 hover:bg-green-700/60';
}

// ── Ruler tick interval ───────────────────────────────────────────────────────

function tickInterval(zoom: number): number {
  if (zoom < 40)  return 5;
  if (zoom < 100) return 1;
  return 0.5;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1);
  return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  musicName: string | null;
  idbUrls: Record<string, string>;
  onFileAdd: (files: FileList) => void;
  onMusicRemove: () => void;
}

type ImportTab = 'generate' | 'animate';

export function NLETimeline({ musicName, idbUrls, onFileAdd, onMusicRemove }: Props) {
  const tracks          = useStudioStore(s => s.timelineTracks);
  const zoom            = useStudioStore(s => s.timelineZoom);
  const setZoom         = useStudioStore(s => s.setTimelineZoom);
  const playheadTime    = useStudioStore(s => s.playheadTime);
  const setPlayheadTime = useStudioStore(s => s.setPlayheadTime);
  const selectedClipId  = useStudioStore(s => s.selectedClipId);
  const setSelected     = useStudioStore(s => s.setSelectedClipId);
  const isPlaying       = useStudioStore(s => s.isPlaying);
  const setIsPlaying    = useStudioStore(s => s.setIsPlaying);
  const generatedImages = useStudioStore(s => s.generatedImages);
  const generatedVideos = useStudioStore(s => s.generatedVideos);
  const addClipToTrack  = useStudioStore(s => s.addClipToTrack);


  const fileInputRef       = useRef<HTMLInputElement>(null);
  const scrollRef          = useRef<HTMLDivElement>(null);
  const dragRef            = useRef<DragState | null>(null);
  const zoomRef            = useRef(zoom);
  const onMusicRemoveRef   = useRef(onMusicRemove);
  onMusicRemoveRef.current = onMusicRemove;
  const [draftClip, setDraftClip] = useState<DraftClip | null>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Import menu state
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('generate');
  // Which + button triggered the menu
  const importBtnRef  = useRef<HTMLButtonElement | null>(null);
  const importMenuRef = useRef<HTMLDivElement | null>(null);

  // Keep zoomRef current
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Total duration ────────────────────────────────────────────────────────

  const totalDuration = tracks.reduce((max, t) =>
    t.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), max), 0
  );
  const contentWidth = Math.max(totalDuration * zoom + 400, 800);

  // ── Auto-scroll during playback ───────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const playheadPx = playheadTime * zoom;
    const container = scrollRef.current;
    const visibleEnd = container.scrollLeft + container.clientWidth;
    if (playheadPx > visibleEnd - 50) {
      container.scrollLeft = playheadPx - container.clientWidth / 2;
    }
  }, [playheadTime, isPlaying, zoom]);

  // ── Helper: get time from clientX ─────────────────────────────────────────

  const getTimeAt = useCallback((clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const relX  = clientX - rect.left + el.scrollLeft;
    return Math.max(0, snap(relX / zoomRef.current));
  }, []);

  // ── Drag implementation ───────────────────────────────────────────────────

  const startDrag = useCallback((
    kind: DragKind,
    clip: TimelineClip,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind,
      clipId: clip.id,
      startX: e.clientX,
      origStart: clip.startTime,
      origDur:   clip.duration,
    };

    function onMove(ev: MouseEvent) {
      const dr = dragRef.current;
      if (!dr || !dr.clipId) return;
      const dx = ev.clientX - dr.startX;
      const dt = dx / zoomRef.current;
      let newStart = dr.origStart;
      let newDur   = dr.origDur;

      if (dr.kind === 'move') {
        newStart = Math.max(0, snap(dr.origStart + dt));
      } else if (dr.kind === 'trim-l') {
        newStart = Math.max(0, snap(dr.origStart + dt));
        newDur   = Math.max(MIN_DUR, snap(dr.origDur   - dt));
      } else if (dr.kind === 'trim-r') {
        newDur   = Math.max(MIN_DUR, snap(dr.origDur   + dt));
      }
      setDraftClip({ id: dr.clipId, startTime: newStart, duration: newDur });
    }

    function onUp(ev: MouseEvent) {
      const dr = dragRef.current;
      if (!dr || !dr.clipId) { cleanup(); return; }
      const dx = ev.clientX - dr.startX;
      const dt = dx / zoomRef.current;
      let newStart = dr.origStart;
      let newDur   = dr.origDur;

      if (dr.kind === 'move') {
        newStart = Math.max(0, snap(dr.origStart + dt));
      } else if (dr.kind === 'trim-l') {
        newStart = Math.max(0, snap(dr.origStart + dt));
        newDur   = Math.max(MIN_DUR, snap(dr.origDur   - dt));
      } else if (dr.kind === 'trim-r') {
        newDur   = Math.max(MIN_DUR, snap(dr.origDur   + dt));
      }
      trimClipWithHistory(dr.clipId, newStart, newDur);
      cleanup();
    }

    function cleanup() {
      dragRef.current = null;
      setDraftClip(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  // trimClipWithHistory is a stable module-level function — no dep needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Playhead drag ─────────────────────────────────────────────────────────

  const startPlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsPlaying(false);
    setPlayheadDragging(true);

    function onMove(ev: MouseEvent) {
      setPlayheadTime(getTimeAt(ev.clientX));
    }
    function onUp(ev: MouseEvent) {
      setPlayheadTime(getTimeAt(ev.clientX));
      setPlayheadDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [getTimeAt, setPlayheadTime, setIsPlaying]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!useStudioStore.getState().isPlaying);
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          useHistoryStore.getState().redo();
        } else {
          useHistoryStore.getState().undo();
        }
        return;
      }
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const id = useStudioStore.getState().selectedClipId;
        if (id && id !== '__music__') duplicateClipWithHistory(id);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const id = useStudioStore.getState().selectedClipId;
        if (id === '__music__') {
          onMusicRemoveRef.current();
          return;
        }
        if (id) removeClipWithHistory(id);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        const id = useStudioStore.getState().selectedClipId;
        if (id && id !== '__music__') splitClipWithHistory(id, useStudioStore.getState().playheadTime);
        return;
      }
      if (e.key === '+' || e.key === '=') {
        setZoom(useStudioStore.getState().timelineZoom + 20);
        return;
      }
      if (e.key === '-') {
        setZoom(useStudioStore.getState().timelineZoom - 20);
        return;
      }
      if (e.key === '[') {
        const id = useStudioStore.getState().selectedClipId;
        if (id) {
          const ph = useStudioStore.getState().playheadTime;
          const clip = useStudioStore.getState().timelineTracks
            .flatMap(t => t.clips).find(c => c.id === id);
          if (clip && ph > clip.startTime) {
            trimClipWithHistory(id, ph, clip.duration - (ph - clip.startTime));
          }
        }
        return;
      }
      if (e.key === ']') {
        const id = useStudioStore.getState().selectedClipId;
        if (id) {
          const ph = useStudioStore.getState().playheadTime;
          const clip = useStudioStore.getState().timelineTracks
            .flatMap(t => t.clips).find(c => c.id === id);
          if (clip && ph > clip.startTime && ph < clip.startTime + clip.duration) {
            trimClipWithHistory(id, clip.startTime, ph - clip.startTime);
          }
        }
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // All state reads use getState() inside the handler — no stale closures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Import from store ─────────────────────────────────────────────────────

  const videoTrack = tracks.find(t => t.type === 'video');

  async function importFromStore(item: MediaItem) {
    const vt = tracks.find(t => t.type === 'video');
    if (!vt) return;
    const sorted = [...vt.clips].sort((a, b) => a.startTime - b.startTime);
    const last = sorted.at(-1);
    const startTime = last ? last.startTime + last.duration : 0;
    const dataUrl = await urlToDataUrl(item.url);
    console.log('[Timeline] importFromStore:', {
      originalUrl: item.url.slice(0, 80),
      resultUrl: dataUrl.slice(0, 80),
      isDataUrl: dataUrl.startsWith('data:'),
      type: item.type,
    });
    addClipToTrack(vt.id, {
      type: item.type,
      startTime,
      duration: item.duration ?? (item.type === 'video' ? 5 : 3),
      sourceUrl: dataUrl,
      prompt: item.prompt,
    });
    setShowImportMenu(false);
  }

  // ── Close import menu on outside click ───────────────────────────────────

  useEffect(() => {
    if (!showImportMenu) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (importBtnRef.current?.contains(target)) return;
      if (importMenuRef.current?.contains(target)) return;
      setShowImportMenu(false);
    }
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [showImportMenu]);

  // ── Render ruler ticks ────────────────────────────────────────────────────

  const interval   = tickInterval(zoom);
  const tickCount  = Math.ceil(contentWidth / zoom / interval) + 1;
  const rulerTicks = Array.from({ length: tickCount }, (_, i) => i * interval);

  // ── Clip rendering (with draft override) ──────────────────────────────────

  function resolvedClip(clip: TimelineClip): TimelineClip {
    if (draftClip && draftClip.id === clip.id) {
      return { ...clip, startTime: draftClip.startTime, duration: draftClip.duration };
    }
    return clip;
  }

  // ── Track rows height total ───────────────────────────────────────────────

  const RULER_H = 32;
  const tracksHeight = tracks.reduce((sum, t) => sum + t.height, 0);
  const totalH = RULER_H + tracksHeight;

  // ── End position of video track for + button ──────────────────────────────

  const videoTrackEndPx = videoTrack
    ? videoTrack.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0) * zoom
    : 0;

  // ── Component ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Tracks area ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left headers */}
        <div
          className="flex w-[100px] flex-shrink-0 flex-col border-r border-white/10 bg-[#0d0d14]"
          style={{ height: totalH }}
        >
          {/* Corner */}
          <div className="flex h-8 flex-shrink-0 items-center border-b border-white/10 px-2">
            <span className="text-[9px] uppercase tracking-wider text-gray-400">Track</span>
          </div>
          {/* Track headers */}
          {tracks.map(track => (
            <div
              key={track.id}
              className="flex flex-shrink-0 items-center gap-1.5 border-b border-white/5 px-2"
              style={{ height: track.height }}
            >
              <span className="text-gray-300">{trackIcon(track.type)}</span>
              <span className="min-w-0 truncate text-[10px] text-gray-300">{track.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ height: totalH }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="relative" style={{ width: contentWidth, height: totalH }}>
            {/* Ruler */}
            <div
              className="sticky top-0 z-20 flex h-8 cursor-crosshair items-end border-b border-white/10 bg-[#0a0a0f] pb-0.5"
              style={{ width: contentWidth }}
              onClick={e => {
                setIsPlaying(false);
                setPlayheadTime(getTimeAt(e.clientX));
              }}
            >
              {rulerTicks.map(t => (
                <div
                  key={t}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: t * zoom }}
                >
                  <span className="mb-1 text-[9px] text-gray-400">{fmtTime(t)}</span>
                  <div className="h-1.5 w-px bg-white/15" />
                </div>
              ))}
              {/* Playhead handle on ruler */}
              <div
                className="absolute top-0 z-30 flex cursor-col-resize flex-col items-center"
                style={{ left: playheadTime * zoom - 5 }}
                onMouseDown={startPlayheadDrag}
              >
                <div
                  className="h-3 w-2.5 rounded-sm bg-green-500"
                  style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }}
                />
              </div>
            </div>

            {/* Track rows + playhead line */}
            <div className="relative" style={{ width: contentWidth }}>
              {/* Playhead vertical line across all tracks */}
              <div
                className="pointer-events-none absolute top-0 z-10 w-0.5 bg-green-500"
                style={{ left: playheadTime * zoom, height: tracksHeight }}
              />

              {tracks.map((track, tIdx) => {
                const showMusicBar = track.type === 'audio' && musicName;

                return (
                  <div
                    key={track.id}
                    data-track-id={track.id}
                    className={[
                      'group relative flex-shrink-0 border-b border-white/5 transition-colors',
                      tIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent',
                      dropTarget === track.id ? 'bg-purple-500/10' : '',
                    ].join(' ')}
                    style={{ height: track.height, width: contentWidth }}
                    onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
                    onDragOver={e => {
                      if (track.type !== 'text') return;
                      if (!e.dataTransfer.types.includes('application/x-studio-text')) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDragEnter={e => {
                      if (track.type !== 'text') return;
                      if (!e.dataTransfer.types.includes('application/x-studio-text')) return;
                      e.preventDefault();
                      setDropTarget(track.id);
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={e => {
                      if (track.type !== 'text') return;
                      e.preventDefault();
                      setDropTarget(null);
                      const raw = e.dataTransfer.getData('application/x-studio-text');
                      if (!raw) return;
                      try {
                        const overlay = JSON.parse(raw) as unknown as TextOverlay;
                        const startTime = snap(getTimeAt(e.clientX));
                        addClipToTrack(track.id, {
                          type: 'text',
                          startTime,
                          duration: 3,
                          overlayData: overlay,
                        });
                      } catch { /* invalid data */ }
                    }}
                  >
                    {/* Music bar — clickable, selectable, deletable */}
                    {showMusicBar && (
                      <div
                        className={[
                          'absolute inset-y-1 cursor-pointer rounded border bg-green-700/25',
                          selectedClipId === '__music__' ? 'border-green-400 ring-1 ring-green-400/50' : 'border-green-500/30',
                        ].join(' ')}
                        style={{ left: 0, right: 0 }}
                        onClick={e => { e.stopPropagation(); setSelected('__music__'); }}
                      >
                        <div className="flex h-full items-center gap-1 px-2">
                          <IconMusic />
                          <span className="flex-1 truncate text-[9px] text-green-400">{musicName}</span>
                          <button
                            className="ml-auto flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-600/70 text-white transition-opacity hover:bg-red-500 group-hover:opacity-100"
                            style={{ opacity: selectedClipId === '__music__' ? 1 : 0 }}
                            onClick={e => { e.stopPropagation(); onMusicRemoveRef.current(); }}
                            title="Remove music"
                          >
                            <span className="text-[8px] font-bold leading-none">✕</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Clips */}
                    {track.clips.map(rawClip => {
                      const clip  = resolvedClip(rawClip);
                      const w     = Math.max(clip.duration * zoom, 4);
                      const left  = clip.startTime * zoom;
                      const isSel = clip.id === selectedClipId;
                      const isActiveAtPlayhead =
                        playheadTime >= clip.startTime && playheadTime < clip.startTime + clip.duration;
                      const label =
                        clip.overlayData?.text ??
                        clip.audioName ??
                        clip.prompt ??
                        `${clip.type} ${clip.duration.toFixed(1)}s`;

                      return (
                        <div
                          key={clip.id}
                          className={[
                            'group absolute inset-y-1 cursor-grab overflow-hidden rounded border text-[10px] font-medium text-white active:cursor-grabbing',
                            clipBg(clip.type, isSel),
                            isActiveAtPlayhead && !isSel ? 'ring-1 ring-white/20' : '',
                          ].join(' ')}
                          style={{ left, width: w }}
                          onClick={e => { e.stopPropagation(); setSelected(clip.id); }}
                          onMouseDown={e => {
                            if ((e.target as HTMLElement).dataset.trim) return;
                            startDrag('move', rawClip, e);
                          }}
                        >
                          {/* Thumbnail (video/image) */}
                          {(clip.type === 'image' || clip.type === 'video') && (() => {
                            const thumbSrc = clip.sourceUrl?.startsWith('idb://')
                              ? idbUrls[clip.sourceUrl]
                              : clip.sourceUrl;
                            return thumbSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbSrc}
                                alt=""
                                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
                                draggable={false}
                              />
                            ) : null;
                          })()}

                          {/* Audio waveform decoration */}
                          {clip.type === 'audio' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center px-1 opacity-40">
                              {Array.from({ length: Math.floor(w / 4) }, (_, i) => (
                                <div
                                  key={i}
                                  className="mx-px flex-shrink-0 rounded-full bg-green-300"
                                  style={{ width: 1, height: `${20 + Math.sin(i * 0.8) * 14}%` }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Label */}
                          <div className="relative truncate px-1.5 py-0.5 leading-tight">
                            {label}
                          </div>

                          {/* Duration badge */}
                          {w > 40 && (
                            <div className="absolute bottom-0.5 right-1 text-[8px] text-white/50">
                              {clip.duration.toFixed(1)}s
                            </div>
                          )}

                          {/* Trim handles */}
                          <div
                            data-trim="l"
                            className="absolute bottom-0 left-0 top-0 w-1.5 cursor-col-resize bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"
                            onMouseDown={e => { e.stopPropagation(); startDrag('trim-l', rawClip, e); }}
                          />
                          <div
                            data-trim="r"
                            className="absolute bottom-0 right-0 top-0 w-1.5 cursor-col-resize bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"
                            onMouseDown={e => { e.stopPropagation(); startDrag('trim-r', rawClip, e); }}
                          />
                        </div>
                      );
                    })}

                    {/* "+" button on empty video track */}
                    {track.type === 'video' && track.clips.length === 0 && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2">
                        <button
                          ref={el => { if (el && track.clips.length === 0) importBtnRef.current = el; }}
                          className="flex items-center gap-1 rounded border border-dashed border-white/20 px-2 py-1 text-[10px] text-gray-400 hover:border-white/30 hover:text-gray-200"
                          onClick={e => { e.stopPropagation(); setShowImportMenu(v => !v); }}
                        >
                          <IconPlus /> Add clips
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* "+" add button on video track end */}
              {videoTrack && videoTrack.clips.length > 0 && (
                <div
                  className="absolute"
                  style={{
                    left: videoTrackEndPx,
                    height: videoTrack.height,
                    top: tracks.findIndex(t => t.type === 'video') * 0 +
                         tracks.slice(0, tracks.findIndex(t => t.type === 'video')).reduce((s, t) => s + t.height, 0),
                  }}
                >
                  <button
                    ref={el => { if (el) importBtnRef.current = el; }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-white/20 text-gray-500 hover:border-white/30 hover:text-gray-300"
                    onClick={e => { e.stopPropagation(); setShowImportMenu(v => !v); }}
                  >
                    <IconPlus />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Import menu ───────────────────────────────────────────────────── */}
      {showImportMenu && (
        <div ref={importMenuRef} className="absolute bottom-[60px] left-[110px] z-50 w-64 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d14] shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <label
              htmlFor="timeline-file-upload"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <IconUpload /> Upload
            </label>
            <button
              onClick={() => setImportTab('generate')}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs transition-colors',
                importTab === 'generate' ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-300',
              ].join(' ')}
            >
              <IconSparkle /> Generate
            </button>
            <button
              onClick={() => setImportTab('animate')}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs transition-colors',
                importTab === 'animate' ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-300',
              ].join(' ')}
            >
              <IconPlay /> Animate
            </button>
            <button
              onClick={() => setShowImportMenu(false)}
              className="px-2 text-gray-600 hover:text-gray-300"
            >
              <IconX />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-40 overflow-y-auto p-2">
            {importTab === 'generate' && (
              generatedImages.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-gray-600">No generated images yet.<br />Go to the Generate tab first.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {generatedImages.slice(0, 20).map(img => (
                    <button
                      key={img.id}
                      onClick={() => { void importFromStore(img); }}
                      className="overflow-hidden rounded border border-white/10 transition-all hover:border-white/30 hover:ring-1 hover:ring-green-500/50"
                      style={{ aspectRatio: '1/1' }}
                      title={img.prompt ?? 'Image'}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )
            )}
            {importTab === 'animate' && (
              generatedVideos.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-gray-600">No generated videos yet.<br />Go to the Animate tab first.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {generatedVideos.slice(0, 20).map(vid => (
                    <button
                      key={vid.id}
                      onClick={() => { void importFromStore(vid); }}
                      className="overflow-hidden rounded border border-white/10 transition-all hover:border-white/30 hover:ring-1 hover:ring-green-500/50"
                      style={{ aspectRatio: '1/1' }}
                      title={vid.prompt ?? 'Video'}
                    >
                      <video src={vid.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Playhead dragging tooltip ─────────────────────────────────────── */}
      {playheadDragging && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-green-600 px-2 py-0.5 text-[10px] font-mono text-white shadow"
          style={{ top: 60, left: '50%', transform: 'translateX(-50%)' }}
        >
          {fmtTime(playheadTime)}
        </div>
      )}

      {/* ── Zoom bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-t border-white/10 bg-[#0d0d14] px-3 py-1.5">
        <button
          onClick={() => setZoom(zoom - 20)}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>

        <input
          type="range"
          min={20}
          max={400}
          step={20}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-green-500"
          style={{ maxWidth: 120 }}
        />

        <button
          onClick={() => setZoom(zoom + 20)}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>

        <span className="text-[10px] text-gray-400">{zoom}px/s</span>
        <span className="ml-auto text-[10px] text-gray-400">
          Total: {totalDuration.toFixed(1)}s
        </span>
      </div>

      {/* File input — sr-only keeps it in DOM so .click() and label association work */}
      <input
        ref={fileInputRef}
        id="timeline-file-upload"
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="sr-only"
        onChange={e => {
          if (e.target.files) onFileAdd(e.target.files);
          e.target.value = '';
          setShowImportMenu(false);
        }}
      />
    </div>
  );
}
