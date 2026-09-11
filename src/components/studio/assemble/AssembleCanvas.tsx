'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useStudioStore } from '@/lib/studio/store';
import { renderSlideshow, DEFAULT_SEQUENCE } from '@/lib/slideshow-renderer';
import type { SlideshowItem, SlideshowConfig, TransitionType, TextOverlay } from '@/lib/slideshow-renderer';

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

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
  const showColors = draft.style === 'bar' || draft.style === 'custom';
  const showLineTwo = draft.style === 'bar';

  return (
    <div className="space-y-3 px-3 py-3">
      {/* Text */}
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

      {/* Style */}
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

      {/* Position */}
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

      {/* Scope */}
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
                ? Array.from({ length: sceneCount }, (_, i) => (
                    <option key={i} value={i}>Scene {i + 1}</option>
                  ))
                : <option value={0}>Scene 1</option>
              }
            </select>
          )}
        </div>
      </div>

      {/* Colors */}
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

      {/* Animation */}
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

      {/* Actions */}
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

const TOOL_CATEGORIES: { id: ToolCategory; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'text',        label: 'Text',        Icon: IconText },
  { id: 'transitions', label: 'Transitions', Icon: IconTransition },
  { id: 'audio',       label: 'Audio',       Icon: IconMusicNote },
  { id: 'effects',     label: 'Effects',     Icon: IconEffects },
  { id: 'stickers',    label: 'Stickers',    Icon: IconSticker },
];

export function AssembleCanvas({ userId: _userId }: Props) {
  const storeItems         = useStudioStore((s) => s.timelineItems);
  const reorderTimeline    = useStudioStore((s) => s.reorderTimeline);
  const removeFromTimeline = useStudioStore((s) => s.removeFromTimeline);
  const addToTimeline      = useStudioStore((s) => s.addToTimeline);
  const textOverlays       = useStudioStore((s) => s.textOverlays);
  const storeAddOverlay    = useStudioStore((s) => s.addTextOverlay);
  const storeRemoveOverlay = useStudioStore((s) => s.removeTextOverlay);
  const storeUpdateOverlay = useStudioStore((s) => s.updateTextOverlay);

  const items: TimelineItem[] = storeItems.map(i => ({
    id:       i.id,
    type:     i.type,
    url:      i.url,
    duration: i.duration ?? (i.type === 'video' ? 5 : 3),
    prompt:   i.prompt,
  }));

  const [durationOverrides, setDurationOverrides] = useState<Record<string, number>>({});

  const mergedItems: TimelineItem[] = items.map(i => ({
    ...i,
    duration: durationOverrides[i.id] ?? i.duration,
  }));

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
  const [dragOverIdx, setDragOverIdx]       = useState<number | null>(null);

  // NLE panel state
  const [activeToolPanel, setActiveToolPanel]     = useState<ToolCategory | null>(null);
  const [selectedClipId, setSelectedClipId]       = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen]     = useState(false);

  // Text overlay editor state
  const [showTemplates, setShowTemplates]         = useState(false);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const [draftOverlay, setDraftOverlay]           = useState<TextOverlay | null>(null);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef  = useRef<HTMLInputElement>(null);
  const resultBlobRef = useRef<string | null>(null);

  const totalDuration = Math.max(
    0,
    mergedItems.reduce((s, i) => s + i.duration, 0) - Math.max(0, mergedItems.length - 1) * TRANSITION_DUR,
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
    for (const item of newItems) {
      addToTimeline({ type: item.type, url: item.url, duration: item.duration });
    }
  }

  function removeItem(id: string) {
    removeFromTimeline(id);
    setDurationOverrides(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedClipId === id) setSelectedClipId(null);
  }

  function applyImageDuration(dur: number) {
    setImageDuration(dur);
    setDurationOverrides(prev => {
      const overrides = { ...prev };
      for (const item of storeItems) {
        if (item.type === 'image') overrides[item.id] = dur;
      }
      return overrides;
    });
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
    reorderTimeline(dragIdx, dropIdx);
    setDragOverIdx(null);
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

  const previewOverlays: TextOverlay[] = [
    ...textOverlays
      .filter((_, i) => !(editingOverlayIdx !== null && editingOverlayIdx >= 0 && i === editingOverlayIdx))
      .filter(o => o.scope !== 'scene'),
    ...(draftOverlay && draftOverlay.scope !== 'scene' ? [draftOverlay] : []),
  ];

  // ── Export ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (mergedItems.length < 2) { setError('Add at least 2 clips to export'); return; }
    setError(null);
    setIsRendering(true);
    setRenderProgress(0);

    if (resultBlobRef.current) { URL.revokeObjectURL(resultBlobRef.current); resultBlobRef.current = null; }
    setResultUrl(null);

    try {
      const globalOverlays   = textOverlays.filter(o => o.scope !== 'scene');
      const perSceneOverlays = textOverlays.filter(o => o.scope === 'scene');

      const slideshowItems: SlideshowItem[] = await Promise.all(
        mergedItems.map(async (item, idx) => {
          const sceneOverlays = perSceneOverlays.filter(o => o.sceneIndex === idx);
          const cardOverlays  = sceneOverlays.length ? sceneOverlays : undefined;

          if (item.type === 'video') {
            const el = await loadVid(item.url);
            return { type: 'video' as const, element: el, duration: item.duration, cardOverlays };
          }
          const el = await loadImg(item.url);
          return {
            type: 'image' as const,
            element: el,
            duration: item.duration,
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

  // ── Selected clip info ─────────────────────────────────────────────────────

  const selectedClip = selectedClipId ? mergedItems.find(i => i.id === selectedClipId) ?? null : null;

  // ── Right panel content ────────────────────────────────────────────────────

  function RightPanelContent() {
    if (editingOverlayIdx !== null && draftOverlay) {
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">
            Text Overlay
          </div>
          <OverlayEditorPanel
            draft={draftOverlay}
            setDraft={setDraftOverlay}
            onSave={saveOverlay}
            onCancel={() => { setEditingOverlayIdx(null); setDraftOverlay(null); }}
            sceneCount={mergedItems.length}
          />
        </>
      );
    }

    if (selectedClip) {
      return (
        <>
          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">
            Clip Properties
          </div>
          <div className="p-3 space-y-3">
            {/* Thumbnail */}
            <div className="overflow-hidden rounded-lg border border-white/10 aspect-video bg-black">
              {selectedClip.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedClip.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={selectedClip.url} className="h-full w-full object-cover" muted playsInline />
              )}
            </div>

            {/* Type badge */}
            <div className="flex items-center gap-2">
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-gray-400">
                {selectedClip.type}
              </span>
              <span className="text-xs text-gray-600">{selectedClip.duration.toFixed(1)}s</span>
            </div>

            {/* Duration */}
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Duration (seconds)</div>
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={durationOverrides[selectedClip.id] ?? selectedClip.duration}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setDurationOverrides(prev => ({ ...prev, [selectedClip.id]: v }));
                }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-600/60"
              />
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(selectedClip.id)}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              <IconX size={12} /> Remove from timeline
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

  // ── Left panel tool content ────────────────────────────────────────────────

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
                <span className="ml-auto rounded-full bg-white/10 px-1.5 py-px text-[10px] text-gray-400">
                  {textOverlays.length}
                </span>
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
        {/* Back button */}
        <button
          onClick={() => setActiveToolPanel(null)}
          className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2 text-xs text-gray-500 transition-colors hover:text-white"
        >
          <IconChevronLeft size={14} />
          <CatIcon size={14} />
          <span>{cat?.label}</span>
        </button>

        {/* Text panel */}
        {activeToolPanel === 'text' && (
          <div className="flex flex-col gap-2 p-2">
            <button
              onClick={() => {
                setShowTemplates(v => !v);
                if (editingOverlayIdx !== null) { setEditingOverlayIdx(null); setDraftOverlay(null); }
              }}
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
                    <button
                      onClick={() => openEditor(idx)}
                      className="flex-shrink-0 text-gray-600 transition-colors hover:text-white"
                      title="Edit"
                    >
                      <IconEdit />
                    </button>
                    <button
                      onClick={() => removeOverlay(idx)}
                      className="flex-shrink-0 text-gray-600 transition-colors hover:text-red-400"
                      title="Remove"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {textOverlays.length === 0 && !showTemplates && (
              <p className="px-1 text-xs text-gray-700">No overlays yet. Click &quot;Add overlay&quot; to start.</p>
            )}
          </div>
        )}

        {/* Transitions panel */}
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
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-gray-500">Image duration</div>
              <div className="flex gap-1 flex-wrap">
                {IMAGE_DUR_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => applyImageDuration(d)}
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

        {/* Audio panel */}
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
                  className="w-full rounded bg-white/5 py-1 text-xs text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => musicInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 py-6 text-gray-600 transition-colors hover:border-white/25 hover:text-gray-400"
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

        {/* Effects panel */}
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

        {/* Stickers panel */}
        {activeToolPanel === 'stickers' && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-gray-600">
            <IconSticker size={28} />
            <p className="text-xs">Coming soon</p>
          </div>
        )}
      </div>
    );
  }

  // ── Canvas aspect ratio styles ─────────────────────────────────────────────

  const canvasStyle: React.CSSProperties =
    aspectRatio === '9:16'
      ? { aspectRatio: '9/16', width: 'auto', height: '100%', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' }
      : aspectRatio === '1:1'
      ? { aspectRatio: '1/1', width: 'auto', height: 'auto', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' }
      : { aspectRatio: '16/9', width: '100%', height: 'auto', maxHeight: 'calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0f]">

      {/* ── Top Tab Bar ────────────────────────────────────────────────────── */}
      <div className="flex h-10 flex-shrink-0 items-center border-b border-white/10 bg-[#0d0d14] px-2">
        {/* Mobile left panel toggle */}
        <button
          onClick={() => setMobilePanelOpen(o => !o)}
          className="mr-2 text-gray-500 hover:text-white md:hidden"
          aria-label="Toggle tool panel"
        >
          <IconHamburger />
        </button>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          <Link
            href="/studio/generate"
            className="flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            <IconSparkle />
            <span className="hidden sm:inline">Generate</span>
          </Link>
          <Link
            href="/studio/animate"
            className="flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            <IconPlay />
            <span className="hidden sm:inline">Animate</span>
          </Link>
          <Link
            href="/studio/assemble"
            className="flex h-10 items-center gap-1.5 border-b-2 border-green-500 px-3 text-sm font-medium text-white"
          >
            <IconScissors />
            <span className="hidden sm:inline">Assemble</span>
          </Link>
        </nav>

        {/* Project name + duration */}
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
            <button
              onClick={() => setEditingName(true)}
              className="truncate text-xs text-gray-400 hover:text-white"
              title="Click to rename"
            >
              {projectName}
            </button>
          )}
          {mergedItems.length > 0 && (
            <span className="rounded-full bg-white/10 px-2 py-px text-[10px] text-gray-500">
              {totalDuration.toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* ── Three-panel body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Tool Panel ─────────────────────────────────────────────── */}
        <aside
          className={[
            'flex-shrink-0 w-[220px] bg-[#0d0d14] border-r border-white/10 overflow-y-auto',
            'hidden md:flex md:flex-col',
            mobilePanelOpen ? 'fixed bottom-0 left-0 top-0 z-40 flex flex-col' : '',
          ].join(' ')}
        >
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

        {/* ── Center + Timeline column ─────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Center Canvas */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 p-4"
            onClick={() => { setSelectedClipId(null); setEditingOverlayIdx(null); setDraftOverlay(null); }}
          >
            {resultUrl ? (
              <div className="flex flex-col items-center gap-4">
                <video
                  src={resultUrl}
                  controls
                  loop
                  className="max-h-full max-w-full rounded-xl object-contain"
                  style={{ maxHeight: 'calc(100% - 80px)' }}
                />
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
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{renderProgress}%</p>
              </div>
            ) : mergedItems.length > 0 ? (
              <div
                className="relative overflow-hidden rounded-xl bg-black shadow-2xl"
                style={canvasStyle}
                onClick={e => e.stopPropagation()}
              >
                {mergedItems[0].type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mergedItems[0].url}
                    alt="Preview"
                    className="h-full w-full object-cover opacity-80"
                  />
                ) : (
                  <video
                    src={mergedItems[0].url}
                    className="h-full w-full object-cover opacity-80"
                    muted
                    playsInline
                  />
                )}

                {/* CSS text overlay preview */}
                {previewOverlays.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {previewOverlays.map((overlay, idx) => (
                      <PreviewOverlayItem key={idx} overlay={overlay} />
                    ))}
                  </div>
                )}

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs text-gray-400">
                  {mergedItems.length} {mergedItems.length === 1 ? 'clip' : 'clips'} · {totalDuration.toFixed(1)}s
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 px-10 py-8 text-gray-600"
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

            {/* Playback controls placeholder */}
            {!resultUrl && !isRendering && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-1.5 backdrop-blur-sm">
                <button disabled className="text-gray-700" title="Skip back">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
                <button disabled className="text-gray-700" title="Play">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <button disabled className="text-gray-700" title="Skip forward">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
                </button>
                <span className="text-[10px] text-gray-600">00:00 / {totalDuration.toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* Export Toolbar */}
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-white/10 bg-[#0d0d14] px-3 py-1.5">
            <button disabled className="rounded px-2.5 py-1 text-xs text-gray-700 cursor-not-allowed" title="Undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
            <button disabled className="rounded px-2.5 py-1 text-xs text-gray-700 cursor-not-allowed" title="Redo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <button disabled className="rounded px-2.5 py-1 text-xs text-gray-700 cursor-not-allowed" title="Split">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7l7 5-7 5"/><path d="M19 7l-7 5 7 5"/></svg>
            </button>
            <button disabled className="rounded px-2.5 py-1 text-xs text-gray-700 cursor-not-allowed" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>

            <button
              onClick={() => void handleExport()}
              disabled={isRendering || mergedItems.length < 2}
              className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
              {isRendering ? `Exporting ${renderProgress}%` : 'Export Clip'}
            </button>
          </div>

          {/* Timeline */}
          <div className="h-[180px] flex-shrink-0 overflow-y-auto border-t border-white/10 bg-[#0d0d14]">
            {/* Clips row */}
            <div
              className="flex items-center gap-1 overflow-x-auto px-3 py-3"
              style={{ scrollbarWidth: 'thin' }}
            >
              {mergedItems.map((item, idx) => (
                <div key={item.id} className="flex flex-shrink-0 items-center">
                  <div
                    className={[
                      'flex-shrink-0 h-[68px] rounded transition-all duration-100',
                      dragOverIdx === idx ? 'w-1 bg-green-500 mr-1' : 'w-0',
                    ].join(' ')}
                  />
                  <div
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDragEnd={() => setDragOverIdx(null)}
                    onClick={() => { setSelectedClipId(item.id); setEditingOverlayIdx(null); setDraftOverlay(null); }}
                    className={[
                      'group relative flex-shrink-0 h-[68px] w-[108px] cursor-pointer overflow-hidden rounded-lg border transition-colors active:cursor-grabbing',
                      selectedClipId === item.id
                        ? 'border-green-500'
                        : dragOverIdx === idx
                        ? 'border-green-500/50'
                        : 'border-white/10 hover:border-white/25',
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
                      onClick={e => { e.stopPropagation(); removeItem(item.id); }}
                      className="absolute right-1 top-1 hidden rounded-full bg-black/75 p-0.5 text-white hover:bg-black group-hover:flex"
                      title="Remove clip"
                    >
                      <IconX size={11} />
                    </button>
                  </div>
                  {idx < mergedItems.length - 1 && (
                    <span className="flex-shrink-0 px-1 text-[10px] text-gray-700">→</span>
                  )}
                </div>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-gray-600 transition-colors hover:border-white/25 hover:text-gray-400"
              >
                <IconPlus size={20} />
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
              <span className="text-gray-600"><IconMusicNote size={15} /></span>
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
            </div>
          </div>
        </div>

        {/* ── Right Inspector Panel ────────────────────────────────────────── */}
        <aside className="hidden w-[260px] flex-shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0d0d14] md:flex">
          <RightPanelContent />
        </aside>

        {/* Mobile right panel: bottom sheet when item selected */}
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
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300">
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
