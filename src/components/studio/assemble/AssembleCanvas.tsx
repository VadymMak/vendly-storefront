'use client';

import { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import { useHistoryStore } from '@/lib/studio/history';
import {
  removeClipWithHistory,
  splitClipWithHistory,
  duplicateClipWithHistory,
} from '@/lib/studio/history-commands';
import type { TimelineClip } from '@/lib/studio/store';
import { fileToDataUrl, urlToDataUrl } from '@/lib/studio/media-utils';
import { saveMediaBlob, loadMediaBlob } from '@/lib/studio/media-db';
import { useSidebarContext } from '@/components/studio/SidebarContext';
import { renderSlideshow, DEFAULT_SEQUENCE, MOTION_PRESETS } from '@/lib/slideshow-renderer';
import type { SlideshowItem, SlideshowConfig, TransitionType, TextOverlay } from '@/lib/slideshow-renderer';
import { NLETimeline } from './Timeline';
import { FontPicker } from './FontPicker';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import { TextFrame } from './TextFrame';
import { TEXT_PRESETS, PRESET_CATEGORIES, PRESET_CATEGORY_LABELS } from '@/lib/fonts/text-presets';
import type { PresetCategory } from '@/lib/fonts/text-presets';
import { loadGoogleFont, loadGoogleFontBoth } from '@/lib/fonts/font-loader';
import { AutoAssembleModal } from './AutoAssembleModal';
import { BrandKitPanel } from './BrandKitPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';

// ── Constants ─────────────────────────────────────────────────────────────────

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '9:16':  { width: 1080, height: 1920 },
  '4:5':   { width: 1080, height: 1350 },
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
const FADE_DURATION_DEFAULT = 0.3;
const DRIFT_THRESHOLD = 0.12;

function syncAudioClips(
  currentTime: number,
  clips: TimelineClip[],
  audioMap: Map<string, HTMLAudioElement>,
  activeSet: Set<string>,
  isMuted: boolean,
) {
  for (const clip of clips) {
    if (clip.type !== 'audio' || clip.muted) continue;
    const el = audioMap.get(clip.id);
    if (!el) continue;
    const clipEnd = clip.startTime + clip.duration;
    const isInRange = currentTime >= clip.startTime && currentTime < clipEnd;
    if (isInRange) {
      const localTime = currentTime - clip.startTime;
      const expectedTime = localTime;
      if (!activeSet.has(clip.id)) {
        el.currentTime = expectedTime;
        el.muted = isMuted;
        el.play().catch(() => {});
        activeSet.add(clip.id);
      } else {
        const drift = Math.abs(el.currentTime - expectedTime);
        if (drift > DRIFT_THRESHOLD) el.currentTime = expectedTime;
      }
      const fadeIn  = clip.fadeInDuration  ?? FADE_DURATION_DEFAULT;
      const fadeOut = clip.fadeOutDuration ?? FADE_DURATION_DEFAULT;
      const base    = clip.volume ?? 1;
      const inGain  = fadeIn  > 0 ? Math.min(localTime / fadeIn, 1) : 1;
      const outGain = fadeOut > 0 ? Math.min((clip.duration - localTime) / fadeOut, 1) : 1;
      el.volume = Math.max(0, Math.min(1, base * Math.min(inGain, outGain)));
    } else {
      if (activeSet.has(clip.id)) {
        el.pause();
        activeSet.delete(clip.id);
      }
    }
  }
}

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function getKenBurnsTransform(
  clipStartTime: number,
  clipDuration: number,
  clipIdx: number,
  currentTime: number,
): string {
  const motionType = DEFAULT_SEQUENCE[clipIdx % DEFAULT_SEQUENCE.length];
  const preset = MOTION_PRESETS[motionType];
  const progress = Math.max(0, Math.min(1, (currentTime - clipStartTime) / clipDuration));
  const eased = easeInOutCubic(progress);
  const scale = preset.startScale + (preset.endScale - preset.startScale) * eased;
  const panX  = (preset.startPanX + (preset.endPanX - preset.startPanX) * eased) * 100;
  const panY  = (preset.startPanY + (preset.endPanY - preset.startPanY) * eased) * 100;
  return `scale(${scale.toFixed(4)}) translate(${panX.toFixed(2)}%, ${panY.toFixed(2)}%)`;
}

function formatTime(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f   = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${f}`;
}


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
  fontSize: 48,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function audioDurationOf(url: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 5));
    audio.addEventListener('error', () => resolve(5));
  });
}

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
    img.onerror = () => reject(new Error(`Failed to load image: ${url.substring(0, 100)}`));
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
    v.onerror = () => reject(new Error(`Failed to load video: ${url.substring(0, 100)}`));
    v.load();
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

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


// ── Tool label map ────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  text:        'Text Overlays',
  transitions: 'Transitions',
  audio:       'Audio',
  effects:     'Effects',
  stickers:    'Stickers',
  'auto-edit': 'Quick Assembly',
  brand:       'Brand Kit',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function posYDefault(position: TextOverlay['position']): number {
  if (position === 'top')    return 10;
  if (position === 'bottom') return 80;
  return 50;
}

function renderOverlayContent(overlay: TextOverlay, scale: number = 1) {
  const rawSize = overlay.fontSize ?? 48;
  const fs = `${Math.round(rawSize * scale)}px`;
  const fw = overlay.fontWeight ?? 'bold';
  if (overlay.style === 'bar') {
    return (
      <div className="rounded whitespace-nowrap" style={{ backgroundColor: overlay.barColor ?? '#E85D04', padding: `${Math.round(6 * scale)}px ${Math.round(12 * scale)}px` }}>
        <div className="leading-tight" style={{ color: overlay.color ?? '#FFFFFF', fontSize: fs, fontWeight: fw, fontFamily: overlay.fontFamily ? `'${overlay.fontFamily}', sans-serif` : undefined }}>{overlay.text}</div>
        {overlay.lineTwo && (
          <div className="leading-tight opacity-80" style={{ color: overlay.color ?? '#FFFFFF', fontSize: `${Math.round(Math.max(10, rawSize * 0.7) * scale)}px` }}>{overlay.lineTwo}</div>
        )}
      </div>
    );
  }
  if (overlay.style === 'brand') {
    return (
      <div className="whitespace-nowrap" style={{ color: overlay.color ?? '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontFamily: overlay.fontFamily ? `'${overlay.fontFamily}', serif` : 'Georgia, serif', fontSize: fs, fontWeight: fw }}>
        {overlay.text}
      </div>
    );
  }
  if (overlay.style === 'subtitle') {
    return (
      <span className="whitespace-nowrap" style={{ fontSize: fs, fontWeight: overlay.fontWeight ?? 'normal', fontFamily: overlay.fontFamily ? `'${overlay.fontFamily}', sans-serif` : undefined, color: overlay.color ?? '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6)', padding: `${Math.round(4 * scale)}px ${Math.round(12 * scale)}px` }}>
        {overlay.text}
      </span>
    );
  }
  if (overlay.style === 'cta') {
    return (
      <div className="whitespace-nowrap" style={{ color: overlay.color ?? '#FFD700', textShadow: '0 2px 10px rgba(0,0,0,0.9)', fontSize: fs, fontWeight: fw, fontFamily: overlay.fontFamily ? `'${overlay.fontFamily}', sans-serif` : undefined }}>
        {overlay.text}
      </div>
    );
  }
  return (
    <span
      className="whitespace-nowrap"
      style={{
        fontSize: fs,
        fontFamily: overlay.fontFamily ?? 'inherit',
        fontWeight: fw,
        color: overlay.color ?? '#FFFFFF',
        backgroundColor: overlay.backgroundColor ?? 'transparent',
        padding: `${Math.round((overlay.paddingY ?? 4) * scale)}px ${Math.round((overlay.paddingX ?? 12) * scale)}px`,
        borderRadius: Math.round(4 * scale),
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}
    >
      {overlay.text}
    </span>
  );
}

interface PreviewOverlayProps {
  overlay: TextOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange: (x: number, y: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function PreviewOverlayItem({ overlay, isSelected, onSelect, onPositionChange, containerRef }: PreviewOverlayProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const posX = overlay.x ?? 50;
  const posY = overlay.y ?? posYDefault(overlay.position);

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const container = containerRef.current;
    if (!container) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: posX, origY: posY };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width)  * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
      const nx = Math.max(5, Math.min(95, dragRef.current.origX + dx));
      const ny = Math.max(5, Math.min(95, dragRef.current.origY + dy));
      if (elRef.current) {
        elRef.current.style.left = `${nx}%`;
        elRef.current.style.top  = `${ny}%`;
      }
    }

    function onUp(ev: MouseEvent) {
      if (!dragRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width)  * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
      const nx = Math.round(Math.max(5, Math.min(95, dragRef.current.origX + dx)));
      const ny = Math.round(Math.max(5, Math.min(95, dragRef.current.origY + dy)));
      onPositionChange(nx, ny);
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={elRef}
      className={[
        'absolute cursor-grab select-none active:cursor-grabbing',
        isSelected ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-transparent rounded' : '',
      ].join(' ')}
      style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)', zIndex: isSelected ? 20 : 10, pointerEvents: 'auto' }}
      onMouseDown={handleMouseDown}
      onClick={e => { e.stopPropagation(); onSelect(); }}
    >
      {renderOverlayContent(overlay)}
      {isSelected && (
        <>
          <div className="pointer-events-none absolute -left-1 -top-1 h-2.5 w-2.5 rounded-sm border border-green-500 bg-green-500/30" />
          <div className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-sm border border-green-500 bg-green-500/30" />
          <div className="pointer-events-none absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-sm border border-green-500 bg-green-500/30" />
          <div className="pointer-events-none absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-sm border border-green-500 bg-green-500/30" />
        </>
      )}
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
  const showLineTwo = draft.style === 'bar';
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('basic');

  function applyPreset(preset: { style: Partial<TextOverlay>; requiredFonts?: string[] }) {
    setDraft({ ...draft, ...preset.style });
    if (preset.requiredFonts) {
      preset.requiredFonts.forEach(f => loadGoogleFontBoth(f).catch(() => {}));
    }
  }

  const categoryPresets = TEXT_PRESETS.filter(p => p.category === presetCategory);

  return (
    <div className="space-y-3 px-3 py-3">
      {/* ── Styles section ── */}
      <div className="border-t border-white/6 pt-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Styles</div>
        <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
          {PRESET_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setPresetCategory(cat)}
              className={[
                'shrink-0 rounded px-2 py-0.5 text-[10px] transition-colors',
                presetCategory === cat
                  ? 'bg-green-600 text-white'
                  : 'bg-white/8 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {PRESET_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {categoryPresets.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="rounded bg-white/8 px-2 py-1 text-[10px] text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Text</div>
        <input
          type="text"
          value={draft.text}
          onChange={e => setDraft({ ...draft, text: e.target.value })}
          className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60 placeholder:text-gray-700"
          placeholder="Enter text..."
          autoFocus
          style={{ fontFamily: draft.fontFamily ? `'${draft.fontFamily}', sans-serif` : undefined }}
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
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Font</div>
        <FontPicker
          value={draft.fontFamily ?? 'Arial'}
          onChange={(family) => setDraft({ ...draft, fontFamily: family })}
        />
      </div>
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
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Font Size</div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={16} max={200} step={1}
            value={draft.fontSize ?? 48}
            onChange={e => setDraft({ ...draft, fontSize: Number(e.target.value) })}
            className="h-1 flex-1 cursor-pointer accent-green-500"
          />
          <input
            type="number" min={16} max={200}
            value={draft.fontSize ?? 48}
            onChange={e => setDraft({ ...draft, fontSize: Math.max(16, Math.min(200, Number(e.target.value) || 48)) })}
            className="w-12 rounded bg-white/10 px-1.5 py-0.5 text-center text-[11px] text-white outline-none focus:ring-1 focus:ring-green-600/60"
          />
          <span className="text-[10px] text-gray-600">pt</span>
        </div>
        <div className="mt-1 flex gap-1">
          {[36, 48, 72, 96, 128].map(size => (
            <button
              key={size}
              onClick={() => setDraft({ ...draft, fontSize: size })}
              className={['rounded px-1.5 py-0.5 text-[10px] transition-colors', (draft.fontSize ?? 48) === size ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'].join(' ')}
            >{size}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Weight</div>
        <div className="flex gap-1">
          <button
            onClick={() => setDraft({ ...draft, fontWeight: 'normal' })}
            className={['rounded px-2.5 py-1 text-xs transition-colors', (draft.fontWeight ?? 'bold') === 'normal' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15'].join(' ')}
          >Normal</button>
          <button
            onClick={() => setDraft({ ...draft, fontWeight: 'bold' })}
            className={['rounded px-2.5 py-1 text-xs font-bold transition-colors', (draft.fontWeight ?? 'bold') === 'bold' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15'].join(' ')}
          >Bold</button>
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Position</div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs text-gray-400">
            X: {Math.round(draft.x ?? 50)}% · Y: {Math.round(draft.y ?? posYDefault(draft.position))}%
          </span>
          <span className="text-[9px] text-gray-600">Drag on canvas</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setDraft({ ...draft, x: 50, y: 10, position: 'top' })}
            className={['rounded px-2 py-0.5 text-[10px] transition-colors', draft.position === 'top' && draft.y === 10 ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'].join(' ')}
          >Top</button>
          <button
            onClick={() => setDraft({ ...draft, x: 50, y: 50, position: 'center' })}
            className={['rounded px-2 py-0.5 text-[10px] transition-colors', draft.position === 'center' && draft.y === 50 ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'].join(' ')}
          >Center</button>
          <button
            onClick={() => setDraft({ ...draft, x: 50, y: 80, position: 'bottom' })}
            className={['rounded px-2 py-0.5 text-[10px] transition-colors', draft.position === 'bottom' && draft.y === 80 ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'].join(' ')}
          >Bottom</button>
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
      <TextPropertiesPanel
        draft={draft}
        onChange={(updates) => setDraft({ ...draft, ...updates })}
      />
      {/* ── Entry Animation ── */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Entry Animation</div>
        <div className="flex flex-wrap gap-1">
          {([
            ['none',       'None'],
            ['fade-in',    'Fade In'],
            ['slide-left', 'Slide Left'],
            ['slide-right','Slide Right'],
            ['slide-up',   'Slide Up'],
            ['slide-down', 'Slide Down'],
            ['typewriter', 'Typewriter'],
            ['bounce',     'Bounce'],
            ['scale-up',   'Scale Up'],
            ['blur-in',    'Blur In'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDraft({ ...draft, animation: val })}
              className={[
                'rounded px-2 py-0.5 text-[10px] transition-colors',
                (draft.animation ?? 'none') === val ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Animation Mode ── */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Animation Mode</div>
        <div className="flex gap-1">
          {([
            ['per-block',     'Block'],
            ['per-word',      'Per Word'],
            ['per-character', 'Per Char'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDraft({ ...draft, animationMode: val })}
              className={[
                'flex-1 rounded px-1 py-0.5 text-[10px] transition-colors',
                (draft.animationMode ?? 'per-block') === val ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Exit Animation ── */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Exit Animation</div>
        <div className="flex flex-wrap gap-1">
          {([
            ['none',            'None'],
            ['fade-out',        'Fade Out'],
            ['slide-out-left',  'Slide Out L'],
            ['slide-out-right', 'Slide Out R'],
            ['scale-down',      'Scale Down'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDraft({ ...draft, exitAnimation: val })}
              className={[
                'rounded px-2 py-0.5 text-[10px] transition-colors',
                (draft.exitAnimation ?? 'none') === val ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-500 hover:bg-white/15 hover:text-gray-300',
              ].join(' ')}
            >
              {label}
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

interface Props {
  userId: string;
}

export function AssembleCanvas({ userId: _userId }: Props) {
  const { expandedTool, setExpandedTool } = useSidebarContext();
  // Store — track-based timeline
  const timelineTracks     = useStudioStore(s => s.timelineTracks);
  const clearAllTracks     = useStudioStore(s => s.clearAllTracks);
  const initDefaultTracks  = useStudioStore(s => s.initDefaultTracks);
  const addClipToTrack     = useStudioStore(s => s.addClipToTrack);
  const selectedClipId     = useStudioStore(s => s.selectedClipId);
  const setSelectedClipId  = useStudioStore(s => s.setSelectedClipId);
  const removeClipFn            = useStudioStore(s => s.removeClip);
  const splitClipFn             = useStudioStore(s => s.splitClip);
  const updateTextClipOverlay   = useStudioStore(s => s.updateTextClipOverlay);
  const playheadTime       = useStudioStore(s => s.playheadTime);
  const setPlayheadTime    = useStudioStore(s => s.setPlayheadTime);
  const isPlaying          = useStudioStore(s => s.isPlaying);
  const setIsPlaying       = useStudioStore(s => s.setIsPlaying);

  // History store
  const canUndo     = useHistoryStore(s => s.canUndo);
  const canRedo     = useHistoryStore(s => s.canRedo);
  const historyUndo = useHistoryStore(s => s.undo);
  const historyRedo = useHistoryStore(s => s.redo);

  // Store — text overlays (left panel)
  const textOverlays       = useStudioStore(s => s.textOverlays);
  const storeAddOverlay    = useStudioStore(s => s.addTextOverlay);
  const storeRemoveOverlay = useStudioStore(s => s.removeTextOverlay);
  const storeUpdateOverlay = useStudioStore(s => s.updateTextOverlay);

  // Init tracks after Zustand has hydrated from sessionStorage
  useEffect(() => {
    const run = () => initDefaultTracks();
    if (useStudioStore.persist.hasHydrated()) {
      run();
    } else {
      const unsub = useStudioStore.persist.onFinishHydration(run);
      return unsub;
    }
  }, [initDefaultTracks]);

  // Auto-open Quick Assembly wizard on empty timeline (first visit)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const run = () => {
      if (autoOpenedRef.current) return;
      autoOpenedRef.current = true;
      const hasClips = useStudioStore.getState().timelineTracks.some(t => t.clips.length > 0);
      if (!hasClips) setExpandedTool('auto-edit');
    };
    if (useStudioStore.persist.hasHydrated()) {
      run();
    } else {
      const unsub = useStudioStore.persist.onFinishHydration(run);
      return unsub;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: video track
  const videoTrack  = timelineTracks.find(t => t.type === 'video');
  const textTrack   = timelineTracks.find(t => t.type === 'text');
  const audioTrack  = timelineTracks.find(t => t.type === 'audio');
  const videoClips  = [...(videoTrack?.clips ?? [])].sort((a, b) => a.startTime - b.startTime);
  const audioClips  = audioTrack?.clips ?? [];
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

  const musicDataUrl = useStudioStore(s => s.musicDataUrl);
  const musicName    = useStudioStore(s => s.musicName);
  const setMusic     = useStudioStore(s => s.setMusic);
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

  // Inspector toggle
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Mute toggle for audio preview
  const [isMuted, setIsMuted] = useState(false);

  // Canvas overlay selection
  const [selectedOverlayIdx, setSelectedOverlayIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Text overlay editor state
  const [showTemplates, setShowTemplates]         = useState(false);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const [draftOverlay, setDraftOverlay]           = useState<TextOverlay | null>(null);

  // IndexedDB blob URL cache: idb://<uuid> → object URL
  const [idbUrls, setIdbUrls] = useState<Record<string, string>>({});
  const idbUrlsRef = useRef<Record<string, string>>({});
  // Keep ref in sync with state so effects can read it without adding idbUrls to deps
  useEffect(() => { idbUrlsRef.current = idbUrls; }, [idbUrls]);
  // Revoke all blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      Object.values(idbUrlsRef.current).forEach(url => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      });
    };
  }, []);

  const musicInputRef  = useRef<HTMLInputElement>(null);
  const nameInputRef   = useRef<HTMLInputElement>(null);
  const resultBlobRef  = useRef<string | null>(null);
  const canvasAreaRef  = useRef<HTMLDivElement>(null);
  const [canvasArea, setCanvasArea] = useState({ w: 0, h: 0 });
  const videoRefsMap   = useRef<Map<string, HTMLVideoElement>>(new Map());
  const animFrameRef   = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const phTimeRef      = useRef(playheadTime);
  const totalDurRef    = useRef(totalDuration);
  const audioMapRef    = useRef<Map<string, HTMLAudioElement>>(new Map());
  const musicAudioRef  = useRef<HTMLAudioElement | null>(null);
  const isMutedRef     = useRef(false);
  const activeAudioRef = useRef<Set<string>>(new Set());
  const audioClipsRef  = useRef<TimelineClip[]>(audioClips);

  useEffect(() => { phTimeRef.current = playheadTime; }, [playheadTime]);
  useEffect(() => { totalDurRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { audioClipsRef.current = audioClips; }, [audioClips]);

  // ── Measure canvas area for JS-computed canvas size ───────────────────────
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasArea({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Resolve idb:// URIs → fresh blob URLs ────────────────────────────────
  // Runs when timelineTracks change (Zustand hydration or new clip adds).
  // Does NOT include idbUrls in deps — uses ref to avoid re-trigger loops.
  useEffect(() => {
    const allClips = timelineTracks.flatMap(t => t.clips);
    const idbClips = allClips.filter(c => c.sourceUrl?.startsWith('idb://'));
    if (idbClips.length === 0) return;

    let cancelled = false;
    void (async () => {
      const resolved: Record<string, string> = {};
      for (const clip of idbClips) {
        if (idbUrlsRef.current[clip.sourceUrl!]) continue;
        const key = clip.sourceUrl!.slice(6); // strip 'idb://'
        try {
          const blobUrl = await loadMediaBlob(key);
          if (blobUrl) {
            resolved[clip.sourceUrl!] = blobUrl;
          } else {
            console.warn('[IDB] No blob found for key:', key.slice(0, 8));
          }
        } catch (e) {
          console.warn('[IDB] Failed to load:', key.slice(0, 8), e);
        }
      }
      if (!cancelled && Object.keys(resolved).length > 0) {
        setIdbUrls(prev => ({ ...prev, ...resolved }));
      }
    })();

    return () => { cancelled = true; };
  }, [timelineTracks]);

  // Auto-open inspector when a text clip is selected on timeline
  useEffect(() => {
    if (selectedClip?.type === 'text') setInspectorOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClip?.id]);

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
      // Music drift correction
      const music = musicAudioRef.current;
      if (music && !music.paused && Math.abs(music.currentTime - next) > 0.5) {
        music.currentTime = next;
      }
      // RAF-driven audio clip lifecycle
      syncAudioClips(next, audioClipsRef.current, audioMapRef.current, activeAudioRef.current, isMutedRef.current);
      if (next >= totalDurRef.current) {
        for (const el of audioMapRef.current.values()) el.pause();
        activeAudioRef.current.clear();
        setIsPlaying(false);
        return;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, setPlayheadTime, setIsPlaying]);

  // ── Video elements — seek on scrub ───────────────────────────────────────

  useEffect(() => {
    if (isPlaying) return;
    if (!activeClip || activeClip.type !== 'video') return;
    const v = videoRefsMap.current.get(activeClip.id);
    if (!v) return;
    const offset = Math.max(0, playheadTime - activeClip.startTime);
    if (Math.abs(v.currentTime - offset) > 0.15) v.currentTime = offset;
  }, [playheadTime, isPlaying, activeClip]);

  // On clip change or play/pause: seek active video and pause all others
  useEffect(() => {
    // Pause all non-active video elements
    for (const [id, v] of videoRefsMap.current.entries()) {
      if (id !== activeClip?.id && !v.paused) v.pause();
    }
    if (!activeClip || activeClip.type !== 'video') return;
    const v = videoRefsMap.current.get(activeClip.id);
    if (!v) return;
    const offset = Math.max(0, playheadTime - activeClip.startTime);
    if (Math.abs(v.currentTime - offset) > 0.2) v.currentTime = offset;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id, isPlaying]);

  // ── Audio: keep isMutedRef in sync ───────────────────────────────────────

  useEffect(() => {
    isMutedRef.current = isMuted;
    for (const el of audioMapRef.current.values()) el.muted = isMuted;
    if (musicAudioRef.current) musicAudioRef.current.muted = isMuted;
  }, [isMuted]);

  // ── Audio clips: create/destroy HTMLAudioElement per clip ─────────────────

  useEffect(() => {
    const map = audioMapRef.current;
    const currentIds = new Set(audioClips.map(c => c.id));
    for (const [id, el] of map) {
      if (!currentIds.has(id)) { el.pause(); el.src = ''; map.delete(id); }
    }
    for (const clip of audioClips) {
      if (!map.has(clip.id) && clip.sourceUrl) {
        const audioSrc = clip.sourceUrl.startsWith('idb://')
          ? idbUrls[clip.sourceUrl]
          : clip.sourceUrl;
        if (audioSrc) {
          const el = new Audio(audioSrc);
          el.preload = 'auto';
          el.muted = isMutedRef.current;
          map.set(clip.id, el);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioClips, idbUrls]);

  // ── Music: create/destroy Audio element from data URL ─────────────────────

  useEffect(() => {
    const prev = musicAudioRef.current;
    if (prev) { prev.pause(); prev.src = ''; }
    musicAudioRef.current = null;
    if (!musicDataUrl) return;
    const el = new Audio(musicDataUrl);
    el.preload = 'auto';
    el.volume = 0.5;
    el.muted = isMutedRef.current;
    musicAudioRef.current = el;
    return () => {
      el.pause(); el.src = '';
      if (musicAudioRef.current === el) musicAudioRef.current = null;
    };
  }, [musicDataUrl]);

  // ── Audio: play/pause sync on isPlaying change ────────────────────────────

  useEffect(() => {
    const music = musicAudioRef.current;
    if (!isPlaying) {
      // Pause all audio clips; RAF tick manages play — just stop everything here
      for (const el of audioMapRef.current.values()) el.pause();
      activeAudioRef.current.clear();
      if (music) music.pause();
      return;
    }
    // Audio clips are started/stopped by RAF tick's syncAudioClips — nothing to do here
    // Music always plays from current playhead
    if (music) {
      const ph = phTimeRef.current;
      const totalDur = totalDurRef.current;
      music.currentTime = ph;
      let musicVol = 0.5;
      if (ph < FADE_DURATION_DEFAULT) musicVol = 0.5 * (ph / FADE_DURATION_DEFAULT);
      else if (totalDur > 0 && totalDur - ph < FADE_DURATION_DEFAULT) musicVol = 0.5 * ((totalDur - ph) / FADE_DURATION_DEFAULT);
      music.volume = Math.max(0, Math.min(0.5, musicVol));
      music.muted = isMutedRef.current;
      music.play().catch(() => {
        setTimeout(() => { music.play().catch(() => {}); }, 50);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, musicDataUrl]);

  // ── Audio: seek when scrubbing ────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying) return;
    // Ensure no clips are marked active while paused
    activeAudioRef.current.clear();
    const map = audioMapRef.current;
    for (const clip of audioClips) {
      const el = map.get(clip.id);
      if (!el) continue;
      const offset = playheadTime - clip.startTime;
      if (offset >= 0 && offset < clip.duration && Math.abs(el.currentTime - offset) > 0.15) {
        el.currentTime = offset;
      }
    }
    const music = musicAudioRef.current;
    if (music && Math.abs(music.currentTime - playheadTime) > 0.15) music.currentTime = playheadTime;
  }, [playheadTime, isPlaying, audioClips]);

  // ── Audio: cleanup on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      for (const el of audioMapRef.current.values()) { el.pause(); el.src = ''; }
      audioMapRef.current.clear();
      const music = musicAudioRef.current;
      if (music) { music.pause(); music.src = ''; }
    };
  }, []);

  // ── File add: goes to video track ─────────────────────────────────────────

  async function handleFileAdd(files: FileList | File[]) {
    if (!videoTrack) return;
    const arr = Array.from(files);
    const endTime = videoClips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0);
    let cursor = endTime;
    for (const file of arr) {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      if (isAudio) {
        const audioTrack = timelineTracks.find(t => t.type === 'audio');
        if (audioTrack) {
          const blobUrl = URL.createObjectURL(file);
          const dur = await audioDurationOf(blobUrl);
          // Audio → IndexedDB
          const key = crypto.randomUUID();
          await saveMediaBlob(key, file);
          const idbUri = `idb://${key}`;
          setIdbUrls(prev => ({ ...prev, [idbUri]: blobUrl }));
          addClipToTrack(audioTrack.id, {
            type: 'audio',
            startTime: 0,
            duration: dur,
            sourceUrl: idbUri,
            audioName: file.name,
          });
        }
      } else if (isVideo) {
        const blobUrl = URL.createObjectURL(file);
        const dur = await videoDurationOf(blobUrl);
        // All videos → IndexedDB; store idb://<uuid> as sourceUrl
        const key = crypto.randomUUID();
        await saveMediaBlob(key, file);
        const idbUri = `idb://${key}`;
        setIdbUrls(prev => ({ ...prev, [idbUri]: blobUrl }));
        addClipToTrack(videoTrack.id, { type: 'video', startTime: cursor, duration: dur, sourceUrl: idbUri });
        cursor += dur;
      } else {
        // Images → IndexedDB; store idb://<uuid> as sourceUrl
        const key = crypto.randomUUID();
        await saveMediaBlob(key, file);
        const idbUri = `idb://${key}`;
        const blobUrl = URL.createObjectURL(file);
        setIdbUrls(prev => ({ ...prev, [idbUri]: blobUrl }));
        addClipToTrack(videoTrack.id, { type: 'image', startTime: cursor, duration: imageDuration, sourceUrl: idbUri });
        cursor += imageDuration;
      }
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

      const tt = timelineTracks.find(t => t.type === 'text');
      if (tt) {
        const sorted = [...tt.clips].sort((a, b) => a.startTime - b.startTime);
        const last = sorted.at(-1);
        const startTime = last ? last.startTime + last.duration : 0;
        const duration = draftOverlay.scope === 'scene' ? 3 : Math.max(totalDuration || 5, 5);
        addClipToTrack(tt.id, {
          type: 'text',
          startTime,
          duration,
          overlayData: draftOverlay,
        });
      }
    } else if (editingOverlayIdx !== null && editingOverlayIdx >= 0) {
      storeUpdateOverlay(editingOverlayIdx, draftOverlay);

      // Update clip overlayData in-place (preserves clip ID, no unmount/remount)
      const tt = timelineTracks.find(t => t.type === 'text');
      if (tt) {
        const sorted = [...tt.clips].sort((a, b) => a.startTime - b.startTime);
        const textClip = sorted[editingOverlayIdx];
        if (textClip) {
          useStudioStore.setState((s) => ({
            timelineTracks: s.timelineTracks.map(t =>
              t.id === tt.id
                ? { ...t, clips: t.clips.map(c => c.id === textClip.id ? { ...c, overlayData: draftOverlay } : c) }
                : t
            ),
          }));
        }
      }
    }

    setEditingOverlayIdx(null);
    setDraftOverlay(null);
    setSelectedClipId(null);
  }

  function removeOverlay(idx: number) {
    const tt = timelineTracks.find(t => t.type === 'text');
    if (tt) {
      const sorted = [...tt.clips].sort((a, b) => a.startTime - b.startTime);
      const textClip = sorted[idx];
      if (textClip) removeClipFn(textClip.id);
    }
    storeRemoveOverlay(idx);
    if (editingOverlayIdx === idx) {
      setEditingOverlayIdx(null);
      setDraftOverlay(null);
    }
  }

  function handleOverlayUpdate(storeIdx: number, updates: Partial<TextOverlay>) {
    // If editing this overlay, update the draft state too
    if (editingOverlayIdx !== null && draftOverlay && storeIdx === editingOverlayIdx) {
      setDraftOverlay({ ...draftOverlay, ...updates });
    }
    if (storeIdx < 0) return;
    const overlay = textOverlays[storeIdx];
    if (!overlay) return;
    const updated = { ...overlay, ...updates };
    storeUpdateOverlay(storeIdx, updated);

    // Update overlayData IN-PLACE — preserves clip ID, avoids React unmount/remount
    const tt = timelineTracks.find(t => t.type === 'text');
    if (tt) {
      const sorted = [...tt.clips].sort((a, b) => a.startTime - b.startTime);
      const textClip = sorted[storeIdx];
      if (textClip) {
        useStudioStore.setState((s) => ({
          timelineTracks: s.timelineTracks.map(t =>
            t.id === tt.id
              ? { ...t, clips: t.clips.map(c => c.id === textClip.id ? { ...c, overlayData: updated } : c) }
              : t
          ),
        }));
      }
    }
  }

  function handleOverlayPositionChange(storeIdx: number, x: number, y: number) {
    handleOverlayUpdate(storeIdx, { x, y });
  }

  // (previewOverlays moved above as editorPreviewOverlays)

  // ── New Project ────────────────────────────────────────────────────────────

  function handleNewProject() {
    if (!confirm('Clear timeline and start over?')) return;
    setIsPlaying(false);
    clearAllTracks();
    initDefaultTracks();
    setSelectedClipId(null);
    setPlayheadTime(0);
    setMusic(null, null);
    setExpandedTool('auto-edit');
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (videoClips.length < 2) { setError('Add at least 2 clips to export'); return; }
    setError(null);

    // Warn when music name is known but data was lost (e.g. after page reload — musicDataUrl is not persisted)
    if (musicName && !musicDataUrl) {
      setError(`Music "${musicName}" is not loaded — it was lost after page reload. Re-add it from the Audio panel, then export again.`);
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    if (resultBlobRef.current) { URL.revokeObjectURL(resultBlobRef.current); resultBlobRef.current = null; }
    setResultUrl(null);

    try {
      // Pre-load all overlay fonts (400 + 700) before export so ctx.font resolves correctly
      const overlayFonts = new Set<string>();
      const textClipsAll = timelineTracks.find(t => t.type === 'text')?.clips ?? [];
      for (const clip of textClipsAll) {
        if (clip.overlayData?.fontFamily) overlayFonts.add(clip.overlayData.fontFamily);
      }
      await Promise.all([...overlayFonts].map(f => loadGoogleFontBoth(f).catch(() => {})));

      // Resolve idb:// URLs to blob URLs before passing to renderer
      const resolvedClips = videoClips.map(clip => ({
        ...clip,
        sourceUrl: resolvedUrl(clip) ?? clip.sourceUrl,
      }));

      // Build renderer-timeline startTimes for each video clip (sequential, no gaps)
      const rendererStarts: number[] = [];
      let rendererCursor = 0;
      for (const clip of resolvedClips) {
        rendererStarts.push(rendererCursor);
        rendererCursor += clip.duration;
      }

      // Map assemble-timeline time → renderer-timeline time
      function toRendererTime(assembleT: number): number {
        for (let i = 0; i < videoClips.length; i++) {
          const vc = videoClips[i];
          if (assembleT <= vc.startTime + vc.duration) {
            return rendererStarts[i] + Math.min(Math.max(0, assembleT - vc.startTime), vc.duration);
          }
        }
        return rendererCursor; // past the end
      }

      // Build timed overlays from text track clips (these carry the real startTime/duration)
      const textClips = [...(textTrack?.clips ?? [])].sort((a, b) => a.startTime - b.startTime);
      const timedOverlays = textClips
        .filter(c => c.overlayData != null)
        .map(c => ({
          ...c.overlayData!,
          from: toRendererTime(c.startTime),
          to: toRendererTime(c.startTime + c.duration),
        }));

      const globalOverlays  = timedOverlays.filter(o => o.scope !== 'scene');
      const perSceneOverlays = timedOverlays.filter(o => o.scope === 'scene');

      const slideshowItems: SlideshowItem[] = await Promise.all(
        resolvedClips.map(async (clip, idx) => {
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

      // Collect audio clips from the audio track for export
      const exportAudioClips = audioTrack?.clips
        .filter(c => !c.muted && c.sourceUrl)
        .map(c => ({
          sourceUrl: c.sourceUrl!.startsWith('idb://') ? (idbUrlsRef.current[c.sourceUrl!] ?? '') : c.sourceUrl!,
          startTime: c.startTime,
          duration: c.duration,
          volume: c.volume,
          fadeInDuration: c.fadeInDuration,
          fadeOutDuration: c.fadeOutDuration,
        }))
        .filter(c => c.sourceUrl) ?? [];

      const config: SlideshowConfig = {
        items: slideshowItems,
        transitionDuration: TRANSITION_DUR,
        transitionType: transition,
        outputSize: ASPECT_SIZES[aspectRatio],
        fps: FPS,
        musicFile: musicDataUrl
          ? await fetch(musicDataUrl).then(r => r.blob()).then(b => new File([b], musicName ?? 'music', { type: b.type }))
          : undefined,
        textOverlays: globalOverlays.length ? globalOverlays : undefined,
        audioClips: exportAudioClips.length > 0 ? exportAudioClips : undefined,
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
      console.error('[Export] Render error:', err);
      setError(err instanceof Error ? err.message : 'Render failed — check console for details');
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

  // ── Per-clip transition style ─────────────────────────────────────────────

  function resolvedUrl(clip: TimelineClip): string | undefined {
    if (!clip.sourceUrl) return undefined;
    if (clip.sourceUrl.startsWith('idb://')) return idbUrls[clip.sourceUrl];
    return clip.sourceUrl;
  }

  function clipLayerStyle(clip: TimelineClip, clipIdx: number): React.CSSProperties {
    const isActive = activeClip?.id === clip.id;

    if (!isPlaying) {
      return {
        opacity: isActive ? 1 : 0,
        transform: 'none',
        zIndex: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        transition: 'none',
        willChange: 'auto',
      } as React.CSSProperties;
    }

    const clipEnd = clip.startTime + clip.duration;
    const prevClip = clipIdx > 0 ? videoClips[clipIdx - 1] : null;
    const nextClip = videoClips[clipIdx + 1];

    let opacity = isActive ? 1 : 0;
    let transform = 'none';
    let zIdx = isActive ? 1 : 0;

    // Outgoing: last TRANSITION_DUR of active clip
    if (isActive && nextClip && playheadTime >= clipEnd - TRANSITION_DUR && playheadTime < clipEnd) {
      const p = (playheadTime - (clipEnd - TRANSITION_DUR)) / TRANSITION_DUR;
      switch (transition) {
        case 'fade':       opacity = 1 - p; break;
        case 'slide-left': opacity = 1; transform = `translateX(${-p * 100}%)`; break;
        case 'slide-right':opacity = 1; transform = `translateX(${p * 100}%)`; break;
        case 'zoom-in':    opacity = 1 - p; transform = `scale(${1 + p * 0.3})`; break;
        case 'zoom-out':   opacity = 1 - p; transform = `scale(${1 - p * 0.3})`; break;
      }
      zIdx = 1;
    }

    // Incoming: first TRANSITION_DUR of this clip while prevClip is finishing
    if (!isActive && prevClip) {
      const prevEnd = prevClip.startTime + prevClip.duration;
      if (playheadTime >= prevEnd - TRANSITION_DUR && playheadTime < prevEnd) {
        const p = (playheadTime - (prevEnd - TRANSITION_DUR)) / TRANSITION_DUR;
        switch (transition) {
          case 'fade':       opacity = p; break;
          case 'slide-left': opacity = 1; transform = `translateX(${(1 - p) * 100}%)`; break;
          case 'slide-right':opacity = 1; transform = `translateX(${-(1 - p) * 100}%)`; break;
          case 'zoom-in':    opacity = p; transform = `scale(${0.7 + p * 0.3})`; break;
          case 'zoom-out':   opacity = p; transform = `scale(${1.3 - p * 0.3})`; break;
        }
        zIdx = 2;
      }
    }

    return {
      opacity,
      transform,
      zIndex: zIdx,
      pointerEvents: isActive ? 'auto' : 'none',
      transition: 'opacity 0.08s linear, transform 0.08s linear',
      willChange: 'opacity, transform',
    } as React.CSSProperties;
  }

  const arNum = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '4:5' ? 4 / 5 : aspectRatio === '1:1' ? 1 : 16 / 9;
  const pad = 32;
  const availW = Math.max(0, canvasArea.w - pad);
  const availH = Math.max(0, canvasArea.h - pad);
  let cW = 0, cH = 0;
  if (availW > 0 && availH > 0) {
    if (availW / availH > arNum) { cH = availH; cW = cH * arNum; }
    else { cW = availW; cH = cW / arNum; }
  }
  const canvasStyle: React.CSSProperties = {
    width: `${Math.round(cW)}px`,
    height: `${Math.round(cH)}px`,
  };

  // ── Active text overlays: only those whose clip spans the current playhead ──

  type ActiveTextOverlay = { overlay: TextOverlay; clipId: string; storeIdx: number };

  const activeTextOverlays: ActiveTextOverlay[] = (() => {
    const tt = timelineTracks.find(t => t.type === 'text');
    const visible: ActiveTextOverlay[] = tt
      ? tt.clips
          .filter(c => c.overlayData && playheadTime >= c.startTime && playheadTime < c.startTime + c.duration)
          .map(c => {
            const storeIdx = textOverlays.findIndex(o => o === c.overlayData || JSON.stringify(o) === JSON.stringify(c.overlayData));
            // Use draftOverlay ONLY for real textOverlays[] entries (storeIdx >= 0).
            // QA clips have storeIdx === -1; they must always use their own overlayData.
            // Without this guard, editingOverlayIdx === -1 would match storeIdx === -1
            // and show stale draftOverlay for ALL QA clips — blocking canvas updates.
            const overlayToShow =
              storeIdx >= 0 && editingOverlayIdx !== null && storeIdx === editingOverlayIdx && draftOverlay
                ? draftOverlay
                : c.overlayData!;
            return { overlay: overlayToShow, clipId: c.id, storeIdx };
          })
      : [];

    // Also show the edited overlay when playhead is outside its clip range
    if (editingOverlayIdx !== null && editingOverlayIdx >= 0 && draftOverlay) {
      const alreadyVisible = visible.some(v => v.storeIdx === editingOverlayIdx);
      if (!alreadyVisible) {
        visible.push({ overlay: draftOverlay, clipId: `editing-${editingOverlayIdx}`, storeIdx: editingOverlayIdx });
      }
    }

    // Show selected text clip on canvas even when playhead is outside its time range.
    // Also, if it's already visible via the playhead filter, replace its overlay with
    // the freshest overlayData so Properties panel edits reflect immediately on canvas.
    if (selectedClipId) {
      const selClip = tt?.clips.find(c => c.id === selectedClipId);
      if (selClip?.overlayData) {
        const existingIdx = visible.findIndex(v => v.clipId === selectedClipId);
        if (existingIdx >= 0) {
          // Clip is in playhead range: override with fresh overlayData so edits appear
          visible[existingIdx] = { ...visible[existingIdx], overlay: selClip.overlayData };
        } else {
          visible.push({ overlay: selClip.overlayData, clipId: selClip.id, storeIdx: -1 });
        }
      }
    }

    return visible;
  })();

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
    if (selectedClip?.type === 'text' && !selectedClip.overlayData) {
      // Text clip without overlayData (e.g. after page reload — overlayData not persisted)
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Text Clip</div>
          <div className="p-3 space-y-3">
            <p className="text-[10px] text-gray-600 leading-relaxed">Text content not available — overlay data is not persisted across reloads. Regenerate via Quick Assembly to edit.</p>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Start (s)</div>
              <input type="number" min={0} step={0.1} value={selectedClip.startTime}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) useStudioStore.getState().trimClip(selectedClip.id, v, selectedClip.duration); }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/60" />
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Duration (s)</div>
              <input type="number" min={0.1} step={0.1} value={selectedClip.duration}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) useStudioStore.getState().trimClip(selectedClip.id, selectedClip.startTime, v); }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/60" />
            </div>
            <button onClick={e => { e.stopPropagation(); removeClipFn(selectedClip.id); }}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:text-red-300">
              <IconX size={12} /> Remove
            </button>
          </div>
        </>
      );
    }
    if (selectedClip?.type === 'text' && selectedClip.overlayData) {
      const ov = selectedClip.overlayData;
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Text Clip</div>
          <div className="p-3 space-y-3">
            {/* Text content */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Text</div>
              <textarea
                rows={3}
                value={ov.text}
                onChange={e => updateTextClipOverlay(selectedClip.id, { text: e.target.value })}
                className="w-full resize-none rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/60 placeholder:text-gray-700"
              />
            </div>
            {/* Font size */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Font Size</div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={16} max={200} step={2}
                  value={ov.fontSize ?? 48}
                  onChange={e => updateTextClipOverlay(selectedClip.id, { fontSize: Number(e.target.value) })}
                  className="h-1 flex-1 cursor-pointer accent-purple-500"
                />
                <span className="w-7 text-right text-xs text-gray-400">{ov.fontSize ?? 48}</span>
              </div>
            </div>
            {/* Color */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Color</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={ov.color ?? '#ffffff'}
                  onChange={e => updateTextClipOverlay(selectedClip.id, { color: e.target.value })}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={ov.color ?? '#ffffff'}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateTextClipOverlay(selectedClip.id, { color: v });
                  }}
                  className="w-20 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white outline-none focus:ring-1 focus:ring-purple-500/40"
                />
              </div>
            </div>
            {/* Position */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Position</div>
              <div className="flex gap-1">
                {(['top', 'center', 'bottom'] as const).map(pos => (
                  <button
                    key={pos}
                    onClick={() => updateTextClipOverlay(selectedClip.id, { position: pos })}
                    className={[
                      'flex-1 rounded py-1 text-xs capitalize transition-colors',
                      ov.position === pos ? 'bg-purple-600/50 text-purple-200' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            {/* Font Family */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Font</div>
              <FontPicker
                value={ov.fontFamily ?? 'Inter'}
                onChange={family => {
                  loadGoogleFont(family).catch(() => {});
                  updateTextClipOverlay(selectedClip.id, { fontFamily: family });
                }}
              />
            </div>
            {/* Timing */}
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Start (s)</div>
                <input
                  type="number" min={0} step={0.1}
                  value={selectedClip.startTime}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) useStudioStore.getState().trimClip(selectedClip.id, v, selectedClip.duration); }}
                  className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/60"
                />
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Duration (s)</div>
                <input
                  type="number" min={0.1} step={0.1}
                  value={selectedClip.duration}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) useStudioStore.getState().trimClip(selectedClip.id, selectedClip.startTime, v); }}
                  className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-purple-500/60"
                />
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); removeClipFn(selectedClip.id); }}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              <IconX size={12} /> Remove
            </button>
          </div>
        </>
      );
    }
    if (selectedClip) {
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Properties</div>
          <div className="p-3 space-y-3">
            {selectedClip.sourceUrl && (selectedClip.type === 'image' || selectedClip.type === 'video') && (() => {
              const thumbUrl = resolvedUrl(selectedClip);
              if (!thumbUrl) return null;
              return (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-black" style={{ aspectRatio: '16/9' }}>
                  {selectedClip.type === 'image'
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                    : <video src={thumbUrl} className="h-full w-full object-cover" muted playsInline />
                  }
                </div>
              );
            })()}
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
              onClick={e => { e.stopPropagation(); removeClipFn(selectedClip.id); }}
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
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="text-xs font-semibold text-gray-300">
            {expandedTool ? (TOOL_LABELS[expandedTool] ?? expandedTool) : ''}
          </span>
          <button onClick={() => setExpandedTool(null)} className="text-gray-500 hover:text-white">
            <IconX size={14} />
          </button>
        </div>

        {expandedTool === 'text' && (
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
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/x-studio-text', JSON.stringify(tpl.overlay));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => openEditor(-1, tpl.overlay)}
                    className="cursor-grab rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-white/25 hover:text-white active:cursor-grabbing"
                    title="Click to open editor · Drag to drop on timeline"
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

        {expandedTool === 'transitions' && (
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

        {expandedTool === 'audio' && (
          <div className="flex flex-col gap-3 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Background music</div>
            {musicDataUrl ? (
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <IconMusicNote size={14} />
                  <span className="min-w-0 flex-1 truncate text-xs text-green-400">{musicName}</span>
                </div>
                <button
                  onClick={() => { setMusic(null, null); if (musicInputRef.current) musicInputRef.current.value = ''; }}
                  className="w-full rounded bg-white/5 py-1 text-xs text-gray-500 hover:bg-white/10 hover:text-gray-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label
                htmlFor="music-file-upload"
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 py-6 text-gray-600 cursor-pointer hover:border-white/25 hover:text-gray-400"
              >
                <IconMusicNote size={20} />
                <span className="text-xs">Add music</span>
                <span className="text-[10px] text-gray-700">MP3, WAV, M4A</span>
              </label>
            )}
            <input
              ref={musicInputRef}
              id="music-file-upload"
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (f) {
                  const dataUrl = await fileToDataUrl(f);
                  setMusic(dataUrl, f.name);
                }
              }}
            />
          </div>
        )}

        {expandedTool === 'effects' && (
          <div className="flex flex-col gap-4 p-3">
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Aspect ratio</div>
              <div className="flex gap-1.5">
                {(['9:16', '4:5', '1:1', '16:9'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={[
                      'flex-1 rounded py-2 text-xs font-medium transition-colors',
                      aspectRatio === ar ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {ar}
                    {ar === '4:5' && <span className="ml-0.5 text-[8px] text-gray-400">IG</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {expandedTool === 'stickers' && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-gray-600">
            <IconSticker size={28} />
            <p className="text-xs">Coming soon</p>
          </div>
        )}

        {expandedTool === 'auto-edit' && (
          <div className="flex-1 overflow-y-auto">
            <AutoAssembleModal
              onClose={() => setExpandedTool(null)}
              onExport={() => void handleExport()}
              onAspectRatio={ar => setAspectRatio(ar as AspectRatio)}
            />
          </div>
        )}

        {expandedTool === 'brand' && (
          <div className="flex-1 overflow-y-auto">
            <BrandKitPanel />
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left tool panel — driven by SidebarContext expandedTool */}
        {expandedTool && (
          <aside className="flex w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#0d0d14]">
            {LeftPanelContent()}
          </aside>
        )}

        {/* Center + Timeline column */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Canvas area + Playback controls */}
          <div className="flex min-h-0 flex-1 flex-col">

          {/* Center Canvas */}
          <div
            ref={canvasAreaRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40"
            onClick={() => { setSelectedClipId(null); setSelectedOverlayIdx(null); setEditingOverlayIdx(null); setDraftOverlay(null); }}
          >
            {isRendering ? (
              <div className="flex w-full max-w-xs flex-col items-center gap-4">
                <p className="text-sm font-medium text-white">
                  {renderPhase === 'audio' ? 'Adding music…' : 'Rendering…'}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${renderProgress}%` }} />
                </div>
                <p className="text-xs text-gray-500">{renderProgress}%</p>
              </div>
            ) : videoClips.length > 0 && cW > 0 && cH > 0 ? (
              <div
                ref={canvasRef}
                className="relative overflow-hidden rounded-xl bg-black shadow-2xl"
                style={canvasStyle}
                onClick={e => e.stopPropagation()}
              >
                {/* Preloaded clip layers — active ± 3 neighbors always in DOM */}
                {(() => {
                  const activeIdx = videoClips.findIndex(c => c.id === activeClip?.id);
                  const nearby = videoClips.filter((_, i) => Math.abs(i - (activeIdx < 0 ? 0 : activeIdx)) <= 3);
                  return nearby.map((clip) => {
                    const srcUrl = resolvedUrl(clip);
                    const isIdb  = clip.sourceUrl?.startsWith('idb://');
                    const globalIdx = videoClips.indexOf(clip);
                    return (
                    <div
                      key={clip.id}
                      className="absolute inset-0 overflow-hidden"
                      style={clipLayerStyle(clip, globalIdx)}
                    >
                      {clip.type === 'image' && srcUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={srcUrl}
                          alt="Preview"
                          className="h-full w-full object-cover"
                          loading="eager"
                          style={isPlaying ? {
                            transform: getKenBurnsTransform(clip.startTime, clip.duration, globalIdx, playheadTime),
                            transformOrigin: 'center center',
                            willChange: 'transform',
                          } : undefined}
                          onError={e => {
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) parent.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-900 p-4 text-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span class="text-[10px] text-gray-500">${clip.prompt ? clip.prompt.slice(0, 60) + '…' : 'Image unavailable'}</span></div>`;
                          }}
                        />
                      )}
                      {clip.type === 'video' && srcUrl && (
                        <video
                          ref={el => { if (el) videoRefsMap.current.set(clip.id, el); else videoRefsMap.current.delete(clip.id); }}
                          src={srcUrl}
                          className="h-full w-full object-cover"
                          muted playsInline preload="auto"
                          onError={e => {
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) parent.innerHTML = `<div class="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-900 p-4 text-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><span class="text-[10px] text-gray-500">Video unavailable</span></div>`;
                          }}
                        />
                      )}
                      {!srcUrl && (
                        <div className="flex h-full w-full items-center justify-center bg-gray-900 text-xs text-gray-600">
                          {isIdb ? 'Loading video…' : clip.prompt ? clip.prompt.slice(0, 40) : 'No preview'}
                        </div>
                      )}
                    </div>
                  ); });
                })()}
                {/* Text overlays */}
                <div className="pointer-events-none absolute inset-0 z-10">
                  {activeTextOverlays.map(({ overlay, clipId, storeIdx }) => (
                    <TextFrame
                      key={clipId}
                      overlay={overlay}
                      isSelected={selectedOverlayIdx === storeIdx}
                      onSelect={() => setSelectedOverlayIdx(storeIdx >= 0 ? storeIdx : null)}
                      onPositionChange={(x, y) => handleOverlayPositionChange(storeIdx, x, y)}
                      onChange={(updates) => handleOverlayUpdate(storeIdx, updates)}
                      containerRef={canvasRef}
                    >
                      {renderOverlayContent(overlay, cW > 0 ? cW / 1080 : 0.35)}
                    </TextFrame>
                  ))}
                </div>
                {/* Clip info badge */}
                <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs text-gray-400">
                  {videoClips.length} {videoClips.length === 1 ? 'clip' : 'clips'} · {totalDuration.toFixed(1)}s
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 px-10 py-8 text-gray-600">
                <IconFilm />
                <p className="text-sm">Add clips from the timeline below</p>
              </div>
            )}

            {/* Inspector toggle */}
            <button
              onClick={() => setInspectorOpen(o => !o)}
              className={[
                'absolute right-2 top-2 rounded-md p-1.5 text-gray-500 transition-colors hover:text-white',
                inspectorOpen ? 'bg-white/10 text-gray-300' : 'hover:bg-white/5',
              ].join(' ')}
              title="Toggle inspector"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
              </svg>
            </button>

          </div>

          {/* Playback controls — static bar below canvas */}
          {!resultUrl && !isRendering && videoClips.length > 0 && (
            <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-white/10 bg-[#0a0a12] px-3 py-2">
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
              {/* Mute toggle */}
              <button
                onClick={() => setIsMuted(m => !m)}
                className={`ml-auto rounded p-1 transition-colors ${isMuted ? 'text-red-400 hover:text-red-300' : 'text-gray-400 hover:text-white'}`}
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
                }
              </button>
            </div>
          )}

          </div>{/* end Canvas area + Playback controls */}

          {/* Export Toolbar */}
          <div className="flex flex-shrink-0 items-center gap-0.5 border-b border-t border-white/10 bg-white/[0.03] px-3 py-1">

            {/* Project name + duration */}
            <div className="flex items-center gap-2 mr-1">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                  className="min-w-0 w-32 rounded bg-white/10 px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="truncate max-w-[140px] text-sm font-medium text-gray-200 hover:text-white transition-colors"
                  title="Click to rename"
                >
                  {projectName}
                </button>
              )}
              {totalDuration > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-px text-[10px] text-gray-400">{totalDuration.toFixed(1)}s</span>
              )}
            </div>

            <div className="mx-2 h-5 w-px bg-white/10" />

            {/* Undo / Redo */}
            <button
              onClick={historyUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={[
                'rounded-md px-2.5 py-1.5 transition-colors',
                canUndo ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-gray-600',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
              </svg>
            </button>
            <button
              onClick={historyRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className={[
                'rounded-md px-2.5 py-1.5 transition-colors',
                canRedo ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-gray-600',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>
              </svg>
            </button>

            <div className="mx-2 h-5 w-px bg-white/10" />

            {/* Split */}
            <button
              onClick={() => { if (selectedClipId && canSplit) splitClipWithHistory(selectedClipId, playheadTime); }}
              disabled={!canSplit}
              title="Split at playhead (S)"
              className={[
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                canSplit ? 'text-gray-200 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-gray-600',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v18"/><path d="m7 7 5 5-5 5"/><path d="m17 7-5 5 5 5"/>
              </svg>
              Split
            </button>

            {/* Duplicate */}
            <button
              onClick={() => { if (selectedClipId && selectedClipId !== '__music__') duplicateClipWithHistory(selectedClipId); }}
              disabled={!selectedClipId || selectedClipId === '__music__'}
              title="Duplicate (Ctrl+D)"
              className={[
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                selectedClipId && selectedClipId !== '__music__' ? 'text-gray-200 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-gray-600',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Dup
            </button>

            {/* Delete */}
            <button
              onClick={() => { if (!selectedClipId) return; if (selectedClipId === '__music__') { setMusic(null, null); } else { removeClipWithHistory(selectedClipId); } }}
              disabled={!selectedClipId}
              title="Delete selected (Del)"
              className={[
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                selectedClipId ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200' : 'cursor-not-allowed text-gray-600',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>

            {/* Brand Kit */}
            <button
              onClick={() => setExpandedTool(expandedTool === 'brand' ? null : 'brand')}
              title="Brand Kit"
              className={[
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                expandedTool === 'brand'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/8 hover:text-gray-200',
              ].join(' ')}
            >
              🏷️ Brand
            </button>

            {/* New Project */}
            <button
              onClick={handleNewProject}
              title="New project"
              className="ml-auto rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-gray-200"
            >
              New Project
            </button>

            {/* Export */}
            <button
              onClick={() => void handleExport()}
              disabled={isRendering || videoClips.length < 2}
              title="Export video"
              className="ml-2 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
              {isRendering ? `Exporting ${renderProgress}%` : 'Export Clip'}
            </button>
          </div>

          {/* NLE Timeline */}
          <div className="h-[228px] flex-shrink-0 border-t border-white/10">
            <NLETimeline
              musicName={musicName}
              idbUrls={idbUrls}
              onFileAdd={files => void handleFileAdd(files)}
              onMusicRemove={() => { setMusic(null, null); if (musicInputRef.current) musicInputRef.current.value = ''; }}
            />
          </div>
        </div>

        {/* Right Inspector Panel — toggleable */}
        {inspectorOpen && (
          <aside className="flex w-[260px] flex-shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0d0d14]">
            {RightPanelContent()}
          </aside>
        )}
      </div>

      {/* Export Preview Modal */}
      {resultUrl && !isRendering && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => { setResultUrl(null); setRenderProgress(0); }}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col items-center gap-4 rounded-2xl bg-gray-900 p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setResultUrl(null); setRenderProgress(0); }}
              className="absolute right-3 top-3 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Close preview"
            >
              <IconX size={20} />
            </button>
            <h3 className="text-sm font-medium text-gray-300">Export Preview</h3>
            <video
              src={resultUrl}
              controls
              autoPlay
              loop
              playsInline
              preload="auto"
              className="max-h-[65vh] w-full rounded-xl object-contain"
              style={{ backgroundColor: '#000' }}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <IconDownload /> Download MP4
              </button>
              <button
                onClick={() => { setResultUrl(null); setRenderProgress(0); }}
                className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
              >
                Close &amp; Continue Editing
              </button>
            </div>
            <p className="text-[10px] text-gray-600">
              Close this preview to continue editing. Export again anytime.
            </p>
          </div>
        </div>
      )}

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
