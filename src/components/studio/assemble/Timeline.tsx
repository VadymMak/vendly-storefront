'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import type { TimelineClip, TimelineTrack } from '@/lib/studio/store';

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
  musicFile: File | null;
  onFileAdd: (files: FileList) => void;
}

export function NLETimeline({ musicFile, onFileAdd }: Props) {
  const tracks          = useStudioStore(s => s.timelineTracks);
  const zoom            = useStudioStore(s => s.timelineZoom);
  const setZoom         = useStudioStore(s => s.setTimelineZoom);
  const playheadTime    = useStudioStore(s => s.playheadTime);
  const setPlayheadTime = useStudioStore(s => s.setPlayheadTime);
  const selectedClipId  = useStudioStore(s => s.selectedClipId);
  const setSelected     = useStudioStore(s => s.setSelectedClipId);
  const trimClip        = useStudioStore(s => s.trimClip);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<DragState | null>(null);
  const zoomRef      = useRef(zoom);
  const [draftClip, setDraftClip] = useState<DraftClip | null>(null);
  const [playheadDragging, setPlayheadDragging] = useState(false);

  // Keep zoomRef current
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Total duration ────────────────────────────────────────────────────────

  const totalDuration = tracks.reduce((max, t) =>
    t.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), max), 0
  );
  const contentWidth = Math.max(totalDuration * zoom + 400, 800);

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
      trimClip(dr.clipId, newStart, newDur);
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
  }, [trimClip]);

  // ── Playhead drag ─────────────────────────────────────────────────────────

  const startPlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
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
  }, [getTimeAt, setPlayheadTime]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const playingRef   = useRef(false);
  const rafRef       = useRef<number | null>(null);
  const lastTimeRef  = useRef(0);
  const phTimeRef    = useRef(playheadTime);
  const totalDurRef  = useRef(totalDuration);

  useEffect(() => { phTimeRef.current = playheadTime; }, [playheadTime]);
  useEffect(() => { totalDurRef.current = totalDuration; }, [totalDuration]);

  function togglePlayback() {
    playingRef.current = !playingRef.current;
    if (playingRef.current) {
      lastTimeRef.current = performance.now();
      function frame(now: number) {
        if (!playingRef.current) return;
        const dt = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        const next = Math.min(phTimeRef.current + dt, totalDurRef.current);
        setPlayheadTime(next);
        if (next >= totalDurRef.current) {
          playingRef.current = false;
          return;
        }
        rafRef.current = requestAnimationFrame(frame);
      }
      rafRef.current = requestAnimationFrame(frame);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }

  const splitClipFn  = useStudioStore(s => s.splitClip);
  const removeClipFn = useStudioStore(s => s.removeClip);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useStudioStore.getState().selectedClipId;
        if (id) removeClipFn(id);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        const id = useStudioStore.getState().selectedClipId;
        if (id) splitClipFn(id, useStudioStore.getState().playheadTime);
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
          const track = useStudioStore.getState().timelineTracks
            .flatMap(t => t.clips).find(c => c.id === id);
          if (track && ph > track.startTime) {
            trimClip(id, ph, track.duration - (ph - track.startTime));
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
            trimClip(id, clip.startTime, ph - clip.startTime);
          }
        }
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeClipFn, splitClipFn, setZoom, trimClip]);

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

  const videoTrack = tracks.find(t => t.type === 'video');

  // ── Track rows height total ───────────────────────────────────────────────

  const RULER_H = 32;
  const tracksHeight = tracks.reduce((sum, t) => sum + t.height, 0);
  const totalH = RULER_H + tracksHeight;

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
            <span className="text-[9px] uppercase tracking-wider text-gray-600">Track</span>
          </div>
          {/* Track headers */}
          {tracks.map(track => (
            <div
              key={track.id}
              className="flex flex-shrink-0 items-center gap-1.5 border-b border-white/5 px-2"
              style={{ height: track.height }}
            >
              <span className="text-gray-500">{trackIcon(track.type)}</span>
              <span className="min-w-0 truncate text-[10px] text-gray-400">{track.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ height: totalH }}
          onClick={() => setSelected(null)}
        >
          <div className="relative" style={{ width: contentWidth, height: totalH }}>
            {/* Ruler */}
            <div
              className="sticky top-0 z-20 flex h-8 cursor-crosshair items-end border-b border-white/10 bg-[#0a0a0f] pb-0.5"
              style={{ width: contentWidth }}
              onClick={e => {
                setPlayheadTime(getTimeAt(e.clientX));
              }}
            >
              {rulerTicks.map(t => (
                <div
                  key={t}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: t * zoom }}
                >
                  <span className="mb-1 text-[9px] text-gray-600">{fmtTime(t)}</span>
                  <div className="h-1.5 w-px bg-white/15" />
                </div>
              ))}
              {/* Playhead handle on ruler */}
              <div
                className="absolute top-0 z-30 flex cursor-col-resize flex-col items-center"
                style={{ left: (draftClip ? playheadTime : playheadTime) * zoom - 5 }}
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
                // Show music bar on audio track if musicFile present
                const showMusicBar = track.type === 'audio' && musicFile;

                return (
                  <div
                    key={track.id}
                    data-track-id={track.id}
                    className={[
                      'relative flex-shrink-0 border-b border-white/5',
                      tIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent',
                    ].join(' ')}
                    style={{ height: track.height, width: contentWidth }}
                    onClick={e => { e.stopPropagation(); setSelected(null); }}
                  >
                    {/* Music placeholder bar */}
                    {showMusicBar && (
                      <div
                        className="pointer-events-none absolute inset-y-1 rounded border border-green-500/30 bg-green-700/25"
                        style={{ left: 0, right: 0 }}
                      >
                        <div className="flex h-full items-center gap-1 px-2">
                          <IconMusic />
                          <span className="truncate text-[9px] text-green-400">{musicFile.name}</span>
                        </div>
                      </div>
                    )}

                    {/* Clips */}
                    {track.clips.map(rawClip => {
                      const clip    = resolvedClip(rawClip);
                      const w       = Math.max(clip.duration * zoom, 4);
                      const left    = clip.startTime * zoom;
                      const isSel   = clip.id === selectedClipId;
                      const label   =
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
                          ].join(' ')}
                          style={{ left, width: w }}
                          onClick={e => { e.stopPropagation(); setSelected(clip.id); }}
                          onMouseDown={e => {
                            if ((e.target as HTMLElement).dataset.trim) return;
                            startDrag('move', rawClip, e);
                          }}
                        >
                          {/* Thumbnail (video/image) */}
                          {clip.sourceUrl && (clip.type === 'image' || clip.type === 'video') && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={clip.sourceUrl}
                              alt=""
                              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
                              draggable={false}
                            />
                          )}

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
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded border border-dashed border-white/15 px-2 py-1 text-[10px] text-gray-600 hover:border-white/25 hover:text-gray-400"
                        onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        <IconPlus /> Add clips
                      </button>
                    )}
                  </div>
                );
              })}

              {/* "+" add button on video track end */}
              {videoTrack && videoTrack.clips.length > 0 && (
                <div
                  className="absolute top-0 z-5"
                  style={{
                    left: videoTrack.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0) * zoom,
                    height: videoTrack.height,
                    top: 0,
                  }}
                >
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-white/15 text-gray-600 hover:border-white/25 hover:text-gray-400"
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <IconPlus />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

        <span className="text-[10px] text-gray-600">{zoom}px/s</span>
        <span className="ml-auto text-[10px] text-gray-600">
          Total: {totalDuration.toFixed(1)}s
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { if (e.target.files) { onFileAdd(e.target.files); e.target.value = ''; } }}
      />
    </div>
  );
}
