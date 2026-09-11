'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useStudioStore } from '@/lib/studio/store';
import { renderSlideshow, DEFAULT_SEQUENCE } from '@/lib/slideshow-renderer';
import type { SlideshowItem, SlideshowConfig, TransitionType, TextOverlay } from '@/lib/slideshow-renderer';
import { NLETimeline } from './Timeline';

// ── Types ─────────────────────────────────────────────────────────────────────

type AspectRatio = '9:16' | '1:1' | '16:9';
type ToolCategory = 'text' | 'transitions' | 'audio' | 'effects' | 'stickers';

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

function formatTime(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f   = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${f}`;
}

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#C9A347', '#E85D04',
  '#EF4444', '#3B82F6', '#22C55E', '#A855F7',
];

const OVERLAY_TEMPLATES: Array<{ label: string; overlay: TextOverlay }> = [
  {
    label: 'Brand Bar',
    overlay: { text: 'Your Brand', lineTwo: 'Address or tagline', style: 'bar', position: 'bottom', barColor: '#E85D04', scope: 'global' },
  },
  {
    label: 'Caption',
    overlay: { text: 'Add your caption', style: 'subtitle', position: 'bottom', scope: 'global' },
  },
  {
    label: 'Title',
    overlay: { text: 'Title Text', style: 'brand', position: 'center', scope: 'global' },
  },
  {
    label: 'Call to Action',
    overlay: { text: 'Visit our website', style: 'cta', position: 'bottom', scope: 'global' },
  },
];

const DEFAULT_DRAFT: TextOverlay = {
  text: '',
  style: 'subtitle',
  position: 'bottom',
  scope: 'global',
  animation: 'none',
};

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

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}

function IconText({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  );
}

function IconTransition({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14"/>
      <path d="M12 5l7 7-7 7"/>
      <rect x="2" y="5" width="5" height="14" rx="1" opacity="0.4" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconMusicNote({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

function IconEffects({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/>
      <path d="M5 20l1 2.5 2.5-1-1-2.5z" opacity="0.6"/>
    </svg>
  );
}

function IconSticker({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  );
}

function IconChevronLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

function IconPlusSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
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

function IconEdit() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PreviewOverlayItem({ overlay }: { overlay: TextOverlay }) {
  const vert =
    overlay.position === 'top' ? 'top-3' :
    overlay.position === 'bottom' ? 'bottom-3' :
    'top-1/2 -translate-y-1/2';

  if (overlay.style === 'bar') {
    return (
      <div
        className={`absolute left-0 right-0 px-3 py-1.5 ${overlay.position === 'top' ? 'top-0' : 'bottom-0'}`}
        style={{ backgroundColor: overlay.barColor ?? '#E85D04' }}
      >
        <div className="text-sm font-bold leading-tight" style={{ color: overlay.color ?? '#FFFFFF' }}>
          {overlay.text}
        </div>
        {overlay.lineTwo && (
          <div className="text-xs leading-tight opacity-80" style={{ color: overlay.color ?? '#FFFFFF' }}>
            {overlay.lineTwo}
          </div>
        )}
      </div>
    );
  }
  if (overlay.style === 'brand') {
    return (
      <div
        className={`absolute left-0 right-0 text-center text-base font-bold ${vert}`}
        style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontFamily: 'Georgia, serif' }}
      >
        {overlay.text}
      </div>
    );
  }
  if (overlay.style === 'subtitle') {
    return (
      <div className={`absolute left-0 right-0 flex justify-center ${vert}`}>
        <span className="rounded-full bg-black/50 px-3 py-1 text-sm text-white">{overlay.text}</span>
      </div>
    );
  }
  if (overlay.style === 'cta') {
    return (
      <div
        className={`absolute left-0 right-0 text-center text-sm font-bold ${vert}`}
        style={{ color: '#FFD700', textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}
      >
        {overlay.text}
      </div>
    );
  }
  const alignClass =
    overlay.textAlign === 'left' ? 'justify-start pl-4' :
    overlay.textAlign === 'right' ? 'justify-end pr-4' :
    'justify-center';
  return (
    <div className={`absolute left-0 right-0 flex ${alignClass} ${vert}`}>
      <span
        style={{
          fontFamily: overlay.fontFamily,
          fontWeight: overlay.fontWeight,
          color: overlay.color ?? '#FFFFFF',
          backgroundColor: overlay.backgroundColor,
          borderRadius: overlay.backgroundColor ? 4 : undefined,
          padding: overlay.backgroundColor ? '2px 8px' : undefined,
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}

function ColorSwatchPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] text-gray-600">{label}</div>
      <div className="flex flex-wrap items-center gap-1">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={[
              'h-5 w-5 rounded border transition-transform hover:scale-110',
              value === c ? 'border-white/60 ring-1 ring-white/30' : 'border-white/10',
            ].join(' ')}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white outline-none focus:ring-1 focus:ring-green-600/60 placeholder:text-gray-700"
          placeholder="#FFFFFF"
        />
      </div>
    </div>
  );
}

interface EditorProps {
  draft: TextOverlay;
  setDraft: (o: TextOverlay) => void;
  onSave: () => void;
  onCancel: () => void;
  sceneCount: number;
}

function OverlayEditorPanel({ draft, setDraft, onSave, onCancel, sceneCount }: EditorProps) {
  const showColors  = draft.style === 'bar' || draft.style === 'custom';
  const showLineTwo = draft.style === 'bar';
  return (
    <div className="space-y-3 px-3 py-3">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Text</div>
        <input
          type="text"
          value={draft.text}
          onChange={e => setDraft({ ...draft, text: e.target.value })}
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60 placeholder:text-gray-700"
          placeholder="Enter text..."
          autoFocus
        />
      </div>
      {showLineTwo && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Second line</div>
          <input
            type="text"
            value={draft.lineTwo ?? ''}
            onChange={e => setDraft({ ...draft, lineTwo: e.target.value || undefined })}
            className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60 placeholder:text-gray-700"
            placeholder="Address, tagline..."
          />
        </div>
      )}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Style</div>
        <div className="flex flex-wrap gap-1">
          {(['brand', 'subtitle', 'cta', 'bar', 'custom'] as const).map(s => (
            <button
              key={s}
              onClick={() => setDraft({ ...draft, style: s })}
              className={[
                'rounded px-2.5 py-1 text-xs transition-colors',
                draft.style === s ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {s === 'bar' ? 'Lower Third' : s === 'cta' ? 'CTA' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Position</div>
        <div className="flex gap-1">
          {(['top', 'center', 'bottom'] as const).map(p => (
            <button
              key={p}
              onClick={() => setDraft({ ...draft, position: p })}
              className={[
                'rounded px-3 py-1 text-xs capitalize transition-colors',
                draft.position === p ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Scope</div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setDraft({ ...draft, scope: 'global', sceneIndex: undefined })}
            className={[
              'rounded px-3 py-1 text-xs transition-colors',
              (draft.scope ?? 'global') === 'global' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
            ].join(' ')}
          >
            All scenes
          </button>
          <button
            onClick={() => setDraft({ ...draft, scope: 'scene', sceneIndex: draft.sceneIndex ?? 0 })}
            className={[
              'rounded px-3 py-1 text-xs transition-colors',
              draft.scope === 'scene' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
            ].join(' ')}
          >
            Specific scene
          </button>
          {draft.scope === 'scene' && (
            <select
              value={draft.sceneIndex ?? 0}
              onChange={e => setDraft({ ...draft, sceneIndex: Number(e.target.value) })}
              className="rounded bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-green-600/60"
            >
              {sceneCount > 0
                ? Array.from({ length: sceneCount }, (_, i) => <option key={i} value={i}>Scene {i + 1}</option>)
                : <option value={0}>Scene 1</option>
              }
            </select>
          )}
        </div>
      </div>
      {showColors && (
        <div className="space-y-2">
          <ColorSwatchPicker
            label={draft.style === 'bar' ? 'Bar color' : 'Background color'}
            value={draft.style === 'bar' ? (draft.barColor ?? '#E85D04') : (draft.backgroundColor ?? '')}
            onChange={v =>
              draft.style === 'bar'
                ? setDraft({ ...draft, barColor: v || undefined })
                : setDraft({ ...draft, backgroundColor: v || undefined })
            }
          />
          <ColorSwatchPicker
            label="Text color"
            value={draft.color ?? '#FFFFFF'}
            onChange={v => setDraft({ ...draft, color: v || undefined })}
          />
        </div>
      )}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Animation</div>
        <div className="flex flex-wrap gap-1">
          {(['none', 'fade-in', 'slide-left', 'slide-up'] as const).map(a => (
            <button
              key={a}
              onClick={() => setDraft({ ...draft, animation: a })}
              className={[
                'rounded px-2.5 py-1 text-xs transition-colors',
                (draft.animation ?? 'none') === a ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {a === 'none' ? 'None' : a === 'fade-in' ? 'Fade In' : a === 'slide-left' ? 'Slide Left' : 'Slide Up'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!draft.text.trim()}
          className="rounded bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded bg-white/10 px-4 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const TOOL_CATEGORIES: { id: ToolCategory; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'text',        label: 'Text',        Icon: IconText },
  { id: 'transitions', label: 'Transitions', Icon: IconTransition },
  { id: 'audio',       label: 'Audio',       Icon: IconMusicNote },
  { id: 'effects',     label: 'Effects',     Icon: IconEffects },
  { id: 'stickers',    label: 'Stickers',    Icon: IconSticker },
];

interface Props {
  userId: string;
}

export function AssembleCanvas({ userId: _userId }: Props) {
  // Store — track-based timeline
  const timelineTracks     = useStudioStore(s => s.timelineTracks);
  const initDefaultTracks  = useStudioStore(s => s.initDefaultTracks);
  const addClipToTrack     = useStudioStore(s => s.addClipToTrack);
  const selectedClipId     = useStudioStore(s => s.selectedClipId);
  const setSelectedClipId  = useStudioStore(s => s.setSelectedClipId);
  const removeClipFn       = useStudioStore(s => s.removeClip);
  const splitClipFn        = useStudioStore(s => s.splitClip);
  const playheadTime       = useStudioStore(s => s.playheadTime);
  const setPlayheadTime    = useStudioStore(s => s.setPlayheadTime);
  const isPlaying          = useStudioStore(s => s.isPlaying);
  const setIsPlaying       = useStudioStore(s => s.setIsPlaying);

  // Store — text overlays (left panel)
  const textOverlays       = useStudioStore(s => s.textOverlays);
  const storeAddOverlay    = useStudioStore(s => s.addTextOverlay);
  const storeRemoveOverlay = useStudioStore(s => s.removeTextOverlay);
  const storeUpdateOverlay = useStudioStore(s => s.updateTextOverlay);

  // Init tracks on mount
  useEffect(() => { initDefaultTracks(); }, [initDefaultTracks]);

  // Derived: video track
  const videoTrack  = timelineTracks.find(t => t.type === 'video');
  const textTrack   = timelineTracks.find(t => t.type === 'text');
  const videoClips  = [...(videoTrack?.clips ?? [])].sort((a, b) => a.startTime - b.startTime);
  const totalDuration = videoClips.reduce((s, c) => Math.max(s, c.startTime + c.duration), 0);

  // Active clip at playhead
  const activeClip = videoClips.find(c =>
    playheadTime >= c.startTime && playheadTime < c.startTime + c.duration
  ) ?? videoClips[0] ?? null;

  // Active text clips from text track
  const activeTextClips = (textTrack?.clips ?? []).filter(c =>
    playheadTime >= c.startTime && playheadTime < c.startTime + c.duration
  );

  // Selected clip info (from any track)
  const selectedClip = selectedClipId
    ? timelineTracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) ?? null
    : null;

  // Can split = selected clip exists AND playhead is within its range
  const canSplit = selectedClip !== null
    && playheadTime > selectedClip.startTime
    && playheadTime < selectedClip.startTime + selectedClip.duration;

  // ── Local state ────────────────────────────────────────────────────────────

  const [musicFile, setMusicFile]           = useState<File | null>(null);
  const [transition, setTransition]         = useState<TransitionType>('fade');
  const [imageDuration, setImageDuration]   = useState(3);
  const [aspectRatio, setAspectRatio]       = useState<AspectRatio>('9:16');
  const [isRendering, setIsRendering]       = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderPhase, setRenderPhase]       = useState<'rendering' | 'audio'>('rendering');
  const [resultUrl, setResultUrl]           = useState<string | null>(null);
  const [resultMime, setResultMime]         = useState('video/mp4');
  const [projectName, setProjectName]       = useState('Untitled Clip');
  const [editingName, setEditingName]       = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  // NLE panel state
  const [activeToolPanel, setActiveToolPanel] = useState<ToolCategory | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // Text overlay editor state
  const [showTemplates, setShowTemplates]         = useState(false);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const [draftOverlay, setDraftOverlay]           = useState<TextOverlay | null>(null);

  const musicInputRef  = useRef<HTMLInputElement>(null);
  const nameInputRef   = useRef<HTMLInputElement>(null);
  const resultBlobRef  = useRef<string | null>(null);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const animFrameRef   = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const phTimeRef      = useRef(playheadTime);
  const totalDurRef    = useRef(totalDuration);
  const activeClipIdRef = useRef<string | null>(null);

  useEffect(() => { phTimeRef.current = playheadTime; }, [playheadTime]);
  useEffect(() => { totalDurRef.current = totalDuration; }, [totalDuration]);

  // ── Playback RAF loop ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    lastTimeRef.current = performance.now();
    function tick(now: number) {
      const dt   = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const next = Math.min(phTimeRef.current + dt, totalDurRef.current);
      phTimeRef.current = next;
      setPlayheadTime(next);
      if (next >= totalDurRef.current) {
        setIsPlaying(false);
        return;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, setPlayheadTime, setIsPlaying]);

  // ── Video element — seek on scrub ─────────────────────────────────────────

  const seekVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || !activeClip || activeClip.type !== 'video') return;
    const offset = Math.max(0, playheadTime - activeClip.startTime);
    if (Math.abs(v.currentTime - offset) > 0.15) v.currentTime = offset;
  }, [playheadTime, activeClip]);

  // Seek when scrubbing (not playing)
  useEffect(() => {
    if (isPlaying) return;
    seekVideo();
  }, [playheadTime, isPlaying, seekVideo]);

  // On clip change: seek to correct offset and play/pause
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!activeClip || activeClip.type !== 'video') {
      v.pause();
      return;
    }
    if (activeClipIdRef.current !== activeClip.id) {
      activeClipIdRef.current = activeClip.id;
      const offset = Math.max(0, playheadTime - activeClip.startTime);
      v.currentTime = offset;
    }
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id, isPlaying]);

  // ── File add: goes to video track ─────────────────────────────────────────

  async function handleFileAdd(files: FileList | File[]) {
    if (!videoTrack) return;
    const arr = Array.from(files);
    const endTime = videoClips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
    let cursor = endTime;
    for (const file of arr) {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      const dur = isVideo ? await videoDurationOf(url) : imageDuration;
      addClipToTrack(videoTrack.id, {
        type: isVideo ? 'video' : 'image',
        startTime: cursor,
        duration: dur,
        sourceUrl: url,
      });
      cursor += dur;
    }
  }

  // ── Text overlay management ────────────────────────────────────────────────

  function openEditor(idx: number, template?: TextOverlay) {
    const base = idx >= 0 ? textOverlays[idx] : (template ?? DEFAULT_DRAFT);
    setDraftOverlay({ ...base });
    setEditingOverlayIdx(idx);
    setShowTemplates(false);
    setSelectedClipId(null);
  }

  function saveOverlay() {
    if (!draftOverlay) return;
    if (editingOverlayIdx === -1) {
      storeAddOverlay(draftOverlay);
    } else if (editingOverlayIdx !== null && editingOverlayIdx >= 0) {
      storeUpdateOverlay(editingOverlayIdx, draftOverlay);
    }
    setEditingOverlayIdx(null);
    setDraftOverlay(null);
  }

  function removeOverlay(idx: number) {
    storeRemoveOverlay(idx);
    if (editingOverlayIdx === idx) {
      setEditingOverlayIdx(null);
      setDraftOverlay(null);
    }
  }

  // (previewOverlays moved above as editorPreviewOverlays)

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (videoClips.length < 2) { setError('Add at least 2 clips to export'); return; }
    setError(null);
    setIsRendering(true);
    setRenderProgress(0);

    if (resultBlobRef.current) { URL.revokeObjectURL(resultBlobRef.current); resultBlobRef.current = null; }
    setResultUrl(null);

    try {
      const globalOverlays  = textOverlays.filter(o => o.scope !== 'scene');
      const perSceneOverlays = textOverlays.filter(o => o.scope === 'scene');

      const slideshowItems: SlideshowItem[] = await Promise.all(
        videoClips.map(async (clip, idx) => {
          const sceneOverlays = perSceneOverlays.filter(o => o.sceneIndex === idx);
          const cardOverlays  = sceneOverlays.length ? sceneOverlays : undefined;

          if (!clip.sourceUrl) {
            return { type: 'image' as const, element: await loadImg(''), duration: clip.duration, motion: DEFAULT_SEQUENCE[idx % DEFAULT_SEQUENCE.length], cardOverlays };
          }
          if (clip.type === 'video') {
            const el = await loadVid(clip.sourceUrl);
            return { type: 'video' as const, element: el, duration: clip.duration, cardOverlays };
          }
          const el = await loadImg(clip.sourceUrl);
          return {
            type: 'image' as const,
            element: el,
            duration: clip.duration,
            motion: DEFAULT_SEQUENCE[idx % DEFAULT_SEQUENCE.length],
            cardOverlays,
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
        textOverlays: globalOverlays.length ? globalOverlays : undefined,
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

  // ── Aspect ratio canvas style ─────────────────────────────────────────────

  const canvasStyle: React.CSSProperties =
    aspectRatio === '9:16'
      ? { aspectRatio: '9/16', width: 'auto', height: '100%', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' }
      : aspectRatio === '1:1'
      ? { aspectRatio: '1/1', width: 'auto', height: 'auto', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' }
      : { aspectRatio: '16/9', width: '100%', height: 'auto', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' };

  // ── Active text overlay preview (for editing panel) ──────────────────────

  // Global textOverlays for the editor live-preview; combined with text track clips
  const editorPreviewOverlays = [
    ...textOverlays
      .filter((_, i) => !(editingOverlayIdx !== null && editingOverlayIdx >= 0 && i === editingOverlayIdx))
      .filter(o => o.scope !== 'scene'),
    ...(draftOverlay && draftOverlay.scope !== 'scene' ? [draftOverlay] : []),
  ];

  // ── Right panel ───────────────────────────────────────────────────────────

  function RightPanelContent() {
    if (editingOverlayIdx !== null && draftOverlay) {
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Text Overlay</div>
          <OverlayEditorPanel
            draft={draftOverlay}
            setDraft={setDraftOverlay}
            onSave={saveOverlay}
            onCancel={() => { setEditingOverlayIdx(null); setDraftOverlay(null); }}
            sceneCount={videoClips.length}
          />
        </>
      );
    }
    if (selectedClip) {
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Properties</div>
          <div className="p-3 space-y-3">
            {selectedClip.sourceUrl && (selectedClip.type === 'image' || selectedClip.type === 'video') && (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
                {selectedClip.type === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={selectedClip.sourceUrl} alt="" className="h-full w-full object-cover" />
                  : <video src={selectedClip.sourceUrl} className="h-full w-full object-cover" muted playsInline />
                }
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-gray-400">{selectedClip.type}</span>
              <span className="text-xs text-gray-600">{selectedClip.duration.toFixed(1)}s @ {selectedClip.startTime.toFixed(1)}s</span>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Start (s)</div>
              <input
                type="number" min={0} step={0.1}
                value={selectedClip.startTime}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) useStudioStore.getState().trimClip(selectedClip.id, v, selectedClip.duration);
                }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60"
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Duration (s)</div>
              <input
                type="number" min={0.1} step={0.1}
                value={selectedClip.duration}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) useStudioStore.getState().trimClip(selectedClip.id, selectedClip.startTime, v);
                }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60"
              />
            </div>
            <button
              onClick={() => removeClipFn(selectedClip.id)}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              <IconX size={12} /> Remove clip
            </button>
          </div>
        </>
      );
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-gray-600">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6M9 12h6M9 15h4"/>
        </svg>
        <p className="text-xs leading-relaxed">Select a clip on the<br />timeline or a text overlay<br />to edit its properties</p>
      </div>
    );
  }

  // ── Left panel ────────────────────────────────────────────────────────────

  function LeftPanelContent() {
    if (!activeToolPanel) {
      return (
        <div className="flex flex-col gap-0.5 p-2">
          {TOOL_CATEGORIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveToolPanel(id)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === 'text' && textOverlays.length > 0 && (
                <span className="ml-auto rounded-full bg-white/10 px-1.5 py-px text-[10px] text-gray-400">{textOverlays.length}</span>
              )}
            </button>
          ))}
        </div>
      );
    }

    const cat = TOOL_CATEGORIES.find(c => c.id === activeToolPanel);
    const CatIcon = cat?.Icon ?? IconText;

    return (
      <div className="flex flex-col">
        <button
          onClick={() => setActiveToolPanel(null)}
          className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-xs text-gray-500 transition-colors hover:text-white"
        >
          <IconChevronLeft size={14} />
          <CatIcon size={14} />
          <span>{cat?.label}</span>
        </button>

        {activeToolPanel === 'text' && (
          <div className="flex flex-col gap-2 p-2">
            <button
              onClick={() => { setShowTemplates(v => !v); if (editingOverlayIdx !== null) { setEditingOverlayIdx(null); setDraftOverlay(null); } }}
              className="flex items-center gap-1 rounded bg-white/5 px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <IconPlusSmall /> Add overlay
            </button>
            {showTemplates && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {OVERLAY_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    onClick={() => openEditor(-1, tpl.overlay)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-white/25 hover:text-white"
                  >
                    {tpl.label}
                  </button>
                ))}
                <button
                  onClick={() => openEditor(-1)}
                  className="rounded-full border border-dashed border-white/10 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-white/20 hover:text-gray-400"
                >
                  Custom
                </button>
              </div>
            )}
            {textOverlays.length > 0 && (
              <div className="space-y-1 px-1">
                {textOverlays.map((overlay, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-white">
                      {overlay.text.slice(0, 24)}{overlay.text.length > 24 ? '…' : ''}
                    </span>
                    <button onClick={() => openEditor(idx)} className="flex-shrink-0 text-gray-600 hover:text-white" title="Edit"><IconEdit /></button>
                    <button onClick={() => removeOverlay(idx)} className="flex-shrink-0 text-gray-600 hover:text-red-400" title="Remove"><IconX size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {textOverlays.length === 0 && !showTemplates && (
              <p className="px-1 text-xs text-gray-700">No overlays yet. Click &quot;Add overlay&quot; to start.</p>
            )}
          </div>
        )}

        {activeToolPanel === 'transitions' && (
          <div className="flex flex-col gap-4 p-3">
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Transition type</div>
              <div className="flex flex-col gap-1">
                {TRANSITION_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTransition(t.value)}
                    className={[
                      'rounded px-3 py-1.5 text-left text-xs transition-colors',
                      transition === t.value ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Default image duration</div>
              <div className="flex flex-wrap gap-1">
                {IMAGE_DUR_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setImageDuration(d)}
                    className={[
                      'rounded px-3 py-1.5 text-xs transition-colors',
                      imageDuration === d ? 'bg-green-600/20 text-green-400' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeToolPanel === 'audio' && (
          <div className="flex flex-col gap-3 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Background music</div>
            {musicFile ? (
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <IconMusicNote size={14} />
                  <span className="min-w-0 flex-1 truncate text-xs text-green-400">{musicFile.name}</span>
                </div>
                <button
                  onClick={() => { setMusicFile(null); if (musicInputRef.current) musicInputRef.current.value = ''; }}
                  className="w-full rounded bg-white/5 py-1 text-xs text-gray-500 hover:bg-white/10 hover:text-gray-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => musicInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 py-6 text-gray-600 hover:border-white/25 hover:text-gray-400"
              >
                <IconMusicNote size={20} />
                <span className="text-xs">Add music</span>
                <span className="text-[10px] text-gray-700">MP3, WAV, M4A</span>
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
        )}

        {activeToolPanel === 'effects' && (
          <div className="flex flex-col gap-4 p-3">
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Aspect ratio</div>
              <div className="flex gap-1.5">
                {(['9:16', '1:1', '16:9'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={[
                      'flex-1 rounded py-2 text-xs font-medium transition-colors',
                      aspectRatio === ar ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeToolPanel === 'stickers' && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-gray-600">
            <IconSticker size={28} />
            <p className="text-xs">Coming soon</p>
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">

      {/* ── Top Tab Bar ──────────────────────────────────────────────────── */}
      <div className="flex h-10 flex-shrink-0 items-center border-b border-white/10 bg-[#0d0d14] px-2">
        <button
          onClick={() => setMobilePanelOpen(o => !o)}
          className="mr-2 text-gray-500 hover:text-white md:hidden"
          aria-label="Toggle tool panel"
        >
          <IconHamburger />
        </button>

        <nav className="flex items-center gap-1">
          <Link href="/studio/generate" className="flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-gray-500 transition-colors hover:text-gray-300">
            <IconSparkle /><span className="hidden sm:inline">Generate</span>
          </Link>
          <Link href="/studio/animate" className="flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-gray-500 transition-colors hover:text-gray-300">
            <IconPlay /><span className="hidden sm:inline">Animate</span>
          </Link>
          <Link href="/studio/assemble" className="flex h-10 items-center gap-1.5 border-b-2 border-green-500 px-3 text-sm font-medium text-white">
            <IconScissors /><span className="hidden sm:inline">Assemble</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 pr-2">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              autoFocus
              className="min-w-0 w-32 rounded bg-white/10 px-2 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-green-600"
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="truncate text-xs text-gray-400 hover:text-white" title="Click to rename">
              {projectName}
            </button>
          )}
          {totalDuration > 0 && (
            <span className="rounded-full bg-white/10 px-2 py-px text-[10px] text-gray-500">{totalDuration.toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* ── Three-panel body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Tool Panel */}
        <aside className={[
          'flex-shrink-0 w-[220px] bg-[#0d0d14] border-r border-white/10 overflow-y-auto',
          'hidden md:flex md:flex-col',
        ].join(' ')}>
          <LeftPanelContent />
        </aside>

        {/* Mobile panel overlay */}
        {mobilePanelOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobilePanelOpen(false)} />
            <aside className="fixed bottom-0 left-0 top-0 z-40 flex w-[220px] flex-col overflow-y-auto bg-[#0d0d14] border-r border-white/10 md:hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="text-xs text-gray-400">Tools</span>
                <button onClick={() => setMobilePanelOpen(false)} className="text-gray-500 hover:text-white"><IconX size={14} /></button>
              </div>
              <LeftPanelContent />
            </aside>
          </>
        )}

        {/* Center + Timeline column */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Center Canvas */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 p-4"
            onClick={() => { setSelectedClipId(null); setEditingOverlayIdx(null); setDraftOverlay(null); }}
          >
            {resultUrl ? (
              <div className="flex flex-col items-center gap-4">
                <video src={resultUrl} controls loop className="max-h-full max-w-full rounded-xl object-contain" style={{ maxHeight: 'calc(100% - 80px)' }} />
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(); }}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    <IconDownload /> Download MP4
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleStartOver(); }}
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
                  <div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${renderProgress}%` }} />
                </div>
                <p className="text-xs text-gray-500">{renderProgress}%</p>
              </div>
            ) : activeClip ? (
              <div
                className="relative overflow-hidden rounded-xl bg-black shadow-2xl"
                style={canvasStyle}
                onClick={e => e.stopPropagation()}
              >
                {/* Image clip */}
                {activeClip.type === 'image' && activeClip.sourceUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeClip.sourceUrl} alt="Preview" className="h-full w-full object-cover" />
                )}
                {/* Video clip — single element, seeked via ref */}
                {activeClip.type === 'video' && activeClip.sourceUrl && (
                  <video
                    ref={videoRef}
                    src={activeClip.sourceUrl}
                    className="h-full w-full object-cover"
                    muted playsInline
                  />
                )}
                {/* No source placeholder */}
                {!activeClip.sourceUrl && (
                  <div className="flex h-full items-center justify-center text-xs text-gray-600">No preview</div>
                )}
                {/* Text track overlays active at playhead */}
                {activeTextClips.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {activeTextClips.filter(c => c.overlayData).map(c => (
                      <PreviewOverlayItem key={c.id} overlay={c.overlayData!} />
                    ))}
                  </div>
                )}
                {/* Editor live-preview overlays */}
                {editorPreviewOverlays.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {editorPreviewOverlays.map((overlay, idx) => (
                      <PreviewOverlayItem key={idx} overlay={overlay} />
                    ))}
                  </div>
                )}
                {/* Clip info badge */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs text-gray-400">
                  {videoClips.length} {videoClips.length === 1 ? 'clip' : 'clips'} · {totalDuration.toFixed(1)}s
                </div>
              </div>
            ) : videoClips.length > 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <p className="text-sm">No clip at this time</p>
                <p className="text-xs">Drag the playhead over a clip to preview it</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 px-10 py-8 text-gray-600">
                <IconFilm />
                <p className="text-sm">Add clips from the timeline below</p>
              </div>
            )}

            {/* Playback controls */}
            {!resultUrl && !isRendering && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm">
                {/* Go to start */}
                <button
                  onClick={() => { setIsPlaying(false); setPlayheadTime(0); }}
                  className="rounded p-1 text-gray-400 hover:text-white"
                  title="Go to start"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
                {/* Prev frame */}
                <button
                  onClick={() => { setIsPlaying(false); setPlayheadTime(Math.max(0, playheadTime - 1 / FPS)); }}
                  className="rounded p-1 text-gray-400 hover:text-white"
                  title="Previous frame"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18V6h2v12H6zm4-6l8-6v12z"/></svg>
                </button>
                {/* Play / Pause */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={videoClips.length === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                  }
                </button>
                {/* Next frame */}
                <button
                  onClick={() => { setIsPlaying(false); setPlayheadTime(Math.min(totalDuration, playheadTime + 1 / FPS)); }}
                  className="rounded p-1 text-gray-400 hover:text-white"
                  title="Next frame"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 18V6h-2v12h2zm-4-6L6 6v12z"/></svg>
                </button>
                {/* Go to end */}
                <button
                  onClick={() => { setIsPlaying(false); setPlayheadTime(totalDuration); }}
                  className="rounded p-1 text-gray-400 hover:text-white"
                  title="Go to end"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 6h-2v12h2zM6 18l8.5-6L6 6v12z"/></svg>
                </button>
                {/* Time display */}
                <span className="ml-1 font-mono text-[10px] text-gray-500">
                  {formatTime(playheadTime)} / {formatTime(totalDuration)}
                </span>
              </div>
            )}
          </div>

          {/* Export Toolbar */}
          <div className="flex flex-shrink-0 items-center gap-1 border-t border-white/10 bg-[#0d0d14] px-3 py-1.5">
            {/* Undo/Redo placeholders */}
            <button disabled className="rounded px-2 py-1 text-xs text-gray-700 cursor-not-allowed" title="Undo (Ctrl+Z)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
            <button disabled className="rounded px-2 py-1 text-xs text-gray-700 cursor-not-allowed" title="Redo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />

            {/* Split */}
            <button
              onClick={() => { if (selectedClipId && canSplit) splitClipFn(selectedClipId, playheadTime); }}
              disabled={!canSplit}
              title="Split at playhead (S)"
              className={[
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                canSplit ? 'text-gray-300 hover:bg-white/10' : 'cursor-not-allowed text-gray-700',
              ].join(' ')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7l7 5-7 5"/><path d="M19 7l-7 5 7 5"/></svg>
              Split
            </button>

            {/* Delete */}
            <button
              onClick={() => { if (selectedClipId) removeClipFn(selectedClipId); }}
              disabled={!selectedClipId}
              title="Delete selected (Del)"
              className={[
                'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                selectedClipId ? 'text-red-400 hover:bg-red-500/10' : 'cursor-not-allowed text-gray-700',
              ].join(' ')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete
            </button>

            {/* Export */}
            <button
              onClick={() => void handleExport()}
              disabled={isRendering || videoClips.length < 2}
              className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
              {isRendering ? `Exporting ${renderProgress}%` : 'Export Clip'}
            </button>
          </div>

          {/* NLE Timeline */}
          <div className="h-[180px] flex-shrink-0 border-t border-white/10">
            <NLETimeline
              musicFile={musicFile}
              onFileAdd={files => void handleFileAdd(files)}
            />
          </div>
        </div>

        {/* Right Inspector Panel */}
        <aside className="hidden w-[260px] flex-shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0d0d14] md:flex">
          <RightPanelContent />
        </aside>

        {/* Mobile right: bottom sheet */}
        {(editingOverlayIdx !== null || selectedClip) && (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0d0d14] shadow-2xl md:hidden">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
            <RightPanelContent />
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/90 px-4 py-3 text-sm text-red-300 shadow-xl">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300"><IconX size={14} /></button>
        </div>
      )}
    </div>
  );
}
