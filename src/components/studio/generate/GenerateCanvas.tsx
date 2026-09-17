'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import UpgradeModal from '@/components/studio/UpgradeModal';
import { ImageDetailModal } from './ImageDetailModal';
import {
  EXAMPLE_PROMPTS, QUICK_FILTERS, OUTPUT_FORMATS,
  ENHANCEMENT_PRESETS, MOTION_PRESETS, SIZE_PRESETS,
  STYLE_CHIPS,
  type OutputFormat, type EnhancementPresetId, type MotionPresetId, type SizePresetId,
  type StyleChipId,
  type PresetKey, PRESET_MAP,
} from '@/lib/studio/constants';
import { type ModelTier } from '@/lib/studio/config';
import { saveToLibrary } from '@/lib/studio/library-store';
import { useStudioStore, type MediaItem } from '@/lib/studio/store';
import { InpaintEditor } from './InpaintEditor';

interface Props {
  userId: string;
  userEmail: string;
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconUpscaleArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchFileFromUrl(url: string, filename: string): Promise<File> {
  const blob = await fetch(url).then(r => r.blob());
  return new File([blob], filename, { type: blob.type || 'image/webp' });
}

async function uploadToStorage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data.url!;
}

async function getPublicUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const file = await fetchFileFromUrl(url, `studio-${Date.now()}.webp`);
  return uploadToStorage(file);
}

async function pollJob(jobId: string, timeoutMs = 600_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await fetch(`/api/studio/job/${jobId}`);
    const data = await res.json() as { status: string; outputUrl?: string; error?: string };
    if (data.status === 'succeeded' && data.outputUrl) return data.outputUrl;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error ?? `Job ${data.status}`);
    }
  }
  throw new Error('Animation timed out');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionButton({ icon, label, sublabel, onClick, highlight }: {
  icon: string; label: string; sublabel?: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-colors ${
        highlight
          ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      {icon === 'sparkle'   && <IconSparkle />}
      {icon === 'edit'      && <IconEdit />}
      {icon === 'video'     && <IconPlay />}
      {icon === 'upscale'   && <IconUpscaleArrow />}
      {icon === 'removebg'  && <IconScissors />}
      {icon === 'download'  && <IconDownload />}
      <span className="text-sm font-medium text-white">{label}</span>
      {sublabel && <span className="text-xs text-gray-500">{sublabel}</span>}
    </button>
  );
}

function SmallAction({ label, onClick, highlight }: {
  label: string; onClick: (e: React.MouseEvent) => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        highlight
          ? 'bg-green-600/80 text-white hover:bg-green-600'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function getBadge(prompt: string | undefined): { text: string; color: string } | null {
  if (!prompt) return null;
  if (prompt.startsWith('[Original]'))     return { text: 'Original',      color: 'bg-gray-600/80' };
  if (prompt.startsWith('[Enhanced]'))     return { text: 'Enhanced ✨',   color: 'bg-green-600/80' };
  if (prompt.startsWith('[Generated]'))    return { text: 'Generated',     color: 'bg-purple-600/80' };
  if (prompt.startsWith('[Edited]'))       return { text: 'Edited',        color: 'bg-blue-600/80' };
  if (prompt.startsWith('[Upscaled]'))     return { text: 'Upscaled',      color: 'bg-amber-600/80' };
  if (prompt.startsWith('[No Background]'))return { text: 'No BG',         color: 'bg-sky-600/80' };
  if (prompt.startsWith('[Inpainted]'))    return { text: 'Inpainted',     color: 'bg-indigo-600/80' };
  return null;
}

function ResultCard({ img, onImprove, onAnimate, onUpscale, onRemoveBg, onDownload, onAddToAssemble, onDelete, onOpen, onCopy, copied, filter, activeFilterId, onFilterChange }: {
  img: MediaItem;
  onImprove: () => void;
  onAnimate: () => void;
  onUpscale: () => void;
  onRemoveBg: () => void;
  onDownload: () => void;
  onAddToAssemble: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onCopy: () => void;
  copied: boolean;
  filter: string;
  activeFilterId: string;
  onFilterChange: (id: string) => void;
}) {
  const isVideo = img.type === 'video';
  const badge = getBadge(img.prompt);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {/* Image area — group + relative scoped here so overlay only covers image */}
      <div className="group relative cursor-pointer" onClick={onOpen}>
        {isVideo ? (
          <video
            src={img.url}
            className="aspect-video w-full object-cover"
            muted loop playsInline
            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.url}
            alt={img.prompt ?? ''}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            style={{ filter: filter !== 'none' ? filter : undefined }}
          />
        )}

        {/* Type badge — always visible, top-left */}
        {badge && (
          <span className={`absolute top-2 left-2 z-10 rounded-full px-2.5 py-0.5 text-xs font-medium text-white pointer-events-none ${badge.color}`}>
            {badge.text}
          </span>
        )}

        {/* Hover overlay — only covers the image, not the filters below */}
        <div
          className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1.5 p-3">
            {!isVideo && (
              <>
                <SmallAction label="Improve" onClick={e => { e.stopPropagation(); onImprove(); }} />
                <SmallAction label="Animate" onClick={e => { e.stopPropagation(); onAnimate(); }} highlight />
                <SmallAction label="Upscale" onClick={e => { e.stopPropagation(); onUpscale(); }} />
                <SmallAction label="No BG"   onClick={e => { e.stopPropagation(); onRemoveBg(); }} />
              </>
            )}
            <SmallAction label="Assemble" onClick={e => { e.stopPropagation(); onAddToAssemble(); }} />
            <SmallAction label="Download" onClick={e => { e.stopPropagation(); onDownload(); }} />
            <button
              onClick={e => { e.stopPropagation(); onCopy(); }}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Copy prompt"
            >
              {copied ? <span className="text-xs text-green-400">✓</span> : <IconCopy />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="ml-auto rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
              title="Delete"
            >
              <IconX />
            </button>
          </div>
          {img.prompt && (
            <p className="px-3 pb-3 text-xs text-gray-300 line-clamp-2">{img.prompt}</p>
          )}
        </div>
      </div>

      {/* Quick filters — outside image container, always clickable */}
      {!isVideo && (
        <div className="flex gap-1 overflow-x-auto px-3 pb-1.5 pt-2">
          {QUICK_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
                activeFilterId === f.id ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnimatePanel({ target, selectedMotion, onMotionChange, duration, onDurationChange, customPrompt, onCustomPromptChange, isAnimating, onAnimate, onClose }: {
  target: MediaItem;
  selectedMotion: MotionPresetId;
  onMotionChange: (id: MotionPresetId) => void;
  duration: 5 | 10;
  onDurationChange: (d: 5 | 10) => void;
  customPrompt: string;
  onCustomPromptChange: (s: string) => void;
  isAnimating: boolean;
  onAnimate: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-white/10 bg-[#0d0d14]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Animate Image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><IconX /></button>
        </div>

        <div className="p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={target.url}
            alt=""
            className="w-full rounded-lg border border-white/10 object-cover"
            style={{ maxHeight: 200 }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="mb-2 text-xs font-medium text-gray-400">Motion style</p>
          <div className="space-y-1.5">
            {MOTION_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => onMotionChange(preset.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedMotion === preset.id
                    ? 'border-green-500/40 bg-green-500/10 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-1 text-xs text-gray-500">Or describe motion:</p>
            <textarea
              value={customPrompt}
              onChange={e => onCustomPromptChange(e.target.value)}
              placeholder="Slow zoom in with steam rising..."
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-400">Duration</p>
            <div className="flex gap-2">
              {([5, 10] as const).map(d => (
                <button
                  key={d}
                  onClick={() => onDurationChange(d)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    duration === d
                      ? 'border-green-500/40 bg-green-500/10 text-white'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {d} sec
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={onAnimate}
            disabled={isAnimating}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isAnimating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Animating...
              </span>
            ) : (
              `Create Video (${duration * 1} credits)`
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GenerateCanvas({ userId: _userId }: Props) {
  // Store
  const generatedImages = useStudioStore((s) => s.generatedImages);
  const addImage        = useStudioStore((s) => s.addImage);
  const removeImage     = useStudioStore((s) => s.removeImage);

  // Mode
  type StudioMode = 'create' | 'improve' | 'animate';
  const [mode, setMode] = useState<StudioMode>('create');

  // Upload
  const [uploadedImage,   setUploadedImage]   = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [dragOver,        setDragOver]        = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const improvePanelRef = useRef<HTMLDivElement>(null);

  // Dynamic model catalog
  interface CatalogModel {
    alias:       string;
    displayName: string;
    provider:    string;
    operation:   string;
    tier:        string;
    creditCost:  number;
    creditType:  string;
    byokOnly:    boolean;
  }
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);

  useEffect(() => {
    fetch('/api/studio/models')
      .then(r => r.json())
      .then((data: { models: CatalogModel[] }) => { setCatalogModels(data.models); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, []);

  useEffect(() => {
    if (mode === 'improve' && improvePanelRef.current) {
      improvePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [mode]);

  const generateModels = catalogModels.filter(m => m.operation === 'generate');

  // Prompt / generate
  const [prompt,          setPrompt]        = useState('');
  const [isGenerating,    setIsGenerating]  = useState(false);
  // Tier-based mode (Simple) vs explicit alias (Advanced)
  type SelectionMode = 'simple' | 'advanced';
  const [selectionMode,   setSelectionMode] = useState<SelectionMode>('simple');
  const [selectedTier,    setSelectedTier]  = useState<ModelTier>('fast');
  const [selectedModel,   setSelectedModel] = useState<string>('');
  const [selectedStyle,   setSelectedStyle] = useState<StyleChipId>('custom');
  const [showAdvanced,    setShowAdvanced]  = useState(false);
  const [selectedSize,    setSelectedSize]  = useState<SizePresetId>('instagram');
  const [outputFormat,    setOutputFormat]  = useState<OutputFormat>('webp');

  const TIERS: { id: ModelTier; label: string; desc: string; credits: number; eta: string }[] = [
    { id: 'fast',    label: 'Quick', desc: 'Fast draft',     credits: 1, eta: '~3s'  },
    { id: 'quality', label: 'Best',  desc: 'Recommended',   credits: 2, eta: '~8s'  },
    { id: 'premium', label: 'HD',    desc: 'Highest detail', credits: 3, eta: '~15s' },
  ];
  const activeTierCredits = TIERS.find(t => t.id === selectedTier)?.credits ?? 1;
  const activeCredits = selectionMode === 'simple'
    ? activeTierCredits
    : (catalogModels.find(m => m.alias === selectedModel)?.creditCost ?? 1);

  // Enhance
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Animate panel
  const [animateTarget,      setAnimateTarget]      = useState<MediaItem | null>(null);
  const [selectedMotion,     setSelectedMotion]     = useState<MotionPresetId>('cinematic');
  const [animDuration,       setAnimDuration]       = useState<5 | 10>(5);
  const [customMotionPrompt, setCustomMotionPrompt] = useState('');
  const [isAnimating,        setIsAnimating]        = useState(false);

  // Inpaint
  const [inpaintImage,  setInpaintImage]  = useState<string | null>(null);
  const inpaintInputRef = useRef<HTMLInputElement>(null);

  // UI
  const [error,       setError]       = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [modalImage,  setModalImage]  = useState<MediaItem | null>(null);
  const [addedToast,  setAddedToast]  = useState<string | null>(null);
  const [copyStates,  setCopyStates]  = useState<Record<string, boolean>>({});
  const [imageFilters, setImageFilters] = useState<Record<string, string>>({});

  // ── Upload handlers ─────────────────────────────────────────────────────────

  function applyUploadedFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploadedImage(file);
    setUploadedPreview(URL.createObjectURL(file));
    setMode('create');
    setPrompt('');
    setError(null);
  }

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyUploadedFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) applyUploadedFile(file);
  }

  function clearUpload() {
    if (uploadedPreview) URL.revokeObjectURL(uploadedPreview);
    setUploadedImage(null);
    setUploadedPreview(null);
    setMode('create');
    setPrompt('');
    if (uploadRef.current) uploadRef.current.value = '';
  }

  // ── Enhance (ai-edit) ───────────────────────────────────────────────────────

  async function handleEnhance(presetId?: EnhancementPresetId) {
    if (!uploadedImage || isEnhancing) return;
    setIsEnhancing(true);
    setError(null);

    try {
      const preset = presetId ? ENHANCEMENT_PRESETS.find(p => p.id === presetId) : null;
      const enhancePrompt = preset?.prompt ?? prompt.trim();

      if (!enhancePrompt) {
        setError('Please select a preset or describe the improvement');
        setIsEnhancing(false);
        return;
      }

      const fd = new FormData();
      fd.append('image', uploadedImage);
      fd.append('prompt', enhancePrompt);
      // default → edit-kontext (Flux Kontext Pro); override only if needed

      const res = await fetch('/api/studio/edit', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (data.needsUpgrade) { setShowUpgrade(true); return; }
        throw new Error(data.error ?? 'Enhancement failed');
      }
      const data = await res.json() as { url: string };

      // Keep original for before/after comparison
      const origBlob = await fetch(uploadedPreview!).then(r => r.blob());
      const origPersistentUrl = URL.createObjectURL(origBlob);
      addImage({
        id: `img-original-${Date.now()}`,
        type: 'image',
        url: origPersistentUrl,
        prompt: '[Original] Uploaded photo',
        format: 'png',
        model: 'original',
        createdAt: Date.now() - 1,
      });

      const newImage: MediaItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image',
        url: data.url,
        prompt: `[Enhanced] ${preset?.label ?? 'Custom'}: ${enhancePrompt.slice(0, 100)}`,
        preset: 'product',
        format: 'png',
        model: 'grok-edit',
        createdAt: Date.now(),
      };
      addImage(newImage);
      saveToLibrary({ type: 'image', url: data.url, prompt: newImage.prompt ?? '', model: 'grok-edit', preset: 'product' });
      clearUpload();
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setIsEnhancing(false);
    }
  }

  // ── Inline animate ──────────────────────────────────────────────────────────

  async function handleInlineAnimate() {
    if (!animateTarget || isAnimating) return;
    setIsAnimating(true);
    setError(null);

    try {
      const publicUrl = await getPublicUrl(animateTarget.url);
      const motionPreset = MOTION_PRESETS.find(p => p.id === selectedMotion);
      const finalMotionPrompt = customMotionPrompt.trim() || motionPreset?.prompt || 'Subtle cinematic motion';

      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:      finalMotionPrompt,
          skillId:     'cinematic',
          aspectRatio: '16:9',
          duration:    animDuration,
          startImage:  publicUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (data.needsUpgrade) { setShowUpgrade(true); return; }
        throw new Error(data.error ?? 'Animation failed');
      }
      const data = await res.json() as { jobId: string };
      const videoUrl = await pollJob(data.jobId);

      const newVideo: MediaItem = {
        id: `vid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'video',
        url: videoUrl,
        prompt: finalMotionPrompt,
        createdAt: Date.now(),
      };
      addImage(newVideo);
      saveToLibrary({ type: 'video', url: videoUrl, prompt: finalMotionPrompt, model: 'kling' });
      setAnimateTarget(null);
      setCustomMotionPrompt('');
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Animation failed');
    } finally {
      setIsAnimating(false);
    }
  }

  // ── Remove BG ───────────────────────────────────────────────────────────────

  async function handleRemoveBg(img: MediaItem) {
    setError(null);
    try {
      const file = img.url.startsWith('blob:')
        ? await fetchFileFromUrl(img.url, `studio-${Date.now()}.png`)
        : await (async () => {
            const blob = await fetch(`/api/studio/proxy-media?url=${encodeURIComponent(img.url)}`).then(r => r.blob());
            return new File([blob], `studio-${Date.now()}.png`, { type: blob.type || 'image/png' });
          })();

      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch('/api/remove-bg', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (data.needsUpgrade) { setShowUpgrade(true); return; }
        throw new Error(data.error ?? 'Background removal failed');
      }
      const data = await res.json() as { url: string };
      addImage({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image', url: data.url,
        prompt: `[No Background] ${img.prompt ?? ''}`,
        format: 'png', model: 'remove-bg', createdAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Background removal failed');
    }
  }

  // ── Upscale ─────────────────────────────────────────────────────────────────

  async function handleUpscale(img: MediaItem) {
    setError(null);
    try {
      const file = img.url.startsWith('blob:')
        ? await fetchFileFromUrl(img.url, `studio-${Date.now()}.png`)
        : await (async () => {
            const blob = await fetch(`/api/studio/proxy-media?url=${encodeURIComponent(img.url)}`).then(r => r.blob());
            return new File([blob], `studio-${Date.now()}.png`, { type: blob.type || 'image/png' });
          })();

      const fd = new FormData();
      fd.append('image', file);
      fd.append('type', 'upscale');

      const res = await fetch('/api/enhance-image', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (data.needsUpgrade) { setShowUpgrade(true); return; }
        throw new Error(data.error ?? 'Upscale failed');
      }
      const data = await res.json() as { url: string };
      addImage({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image', url: data.url,
        prompt: `[Upscaled] ${img.prompt ?? ''}`,
        format: 'png', model: 'upscale', createdAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upscale failed');
    }
  }

  // ── Generate from prompt ────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt || isGenerating) return;

    // Image + prompt → ai-edit
    if (uploadedImage) {
      handleEnhance();
      return;
    }

    const size = SIZE_PRESETS.find(s => s.id === selectedSize) ?? SIZE_PRESETS[0];
    setIsGenerating(true);
    setError(null);

    try {
      // Apply style chip prefix (user's original prompt preserved for display)
      const styleChip  = STYLE_CHIPS.find(s => s.id === selectedStyle);
      const styledPrompt = styleChip?.promptPrefix
        ? `${styleChip.promptPrefix} ${finalPrompt}`
        : finalPrompt;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:       styledPrompt,
          ...(selectionMode === 'simple'
            ? { tier: selectedTier }
            : { modelAlias: selectedModel }),
          aspect_ratio:  size.aspect_ratio,
          megapixels:    size.megapixels,
          target_width:  size.target_width,
          target_height: size.target_height,
          output_format: outputFormat,
        }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (e.needsUpgrade) { setShowUpgrade(true); return; }
        throw new Error(e.error ?? 'Generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const modelLabel = selectionMode === 'simple'
        ? (TIERS.find(t => t.id === selectedTier)?.label ?? selectedTier)
        : selectedModel;

      const newImage: MediaItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image', url,
        prompt: `[Generated] ${finalPrompt}`,
        preset: 'product',
        format: outputFormat,
        model: modelLabel,
        createdAt: Date.now(),
      };
      addImage(newImage);
      saveToLibrary({ type: 'image', url, prompt: `[Generated] ${finalPrompt}`, model: modelLabel, preset: 'product' });

      fetch('/api/studio/track-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image' }),
      }).catch(() => {});
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isGenerating, selectedSize, outputFormat, selectedModel, selectedTier, selectionMode, selectedStyle, uploadedImage]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  }

  // ── Upload → animate/upscale/removebg helpers ────────────────────────────────

  function makeUploadedMediaItem(): MediaItem {
    return {
      id: `img-uploaded-${Date.now()}`,
      type: 'image',
      url: uploadedPreview!,
      prompt: 'Uploaded image',
      createdAt: Date.now(),
    };
  }

  function handleAnimateUploadedImage() {
    if (!uploadedPreview) return;
    setAnimateTarget(makeUploadedMediaItem());
    setSelectedMotion('cinematic');
    setCustomMotionPrompt('');
  }

  async function handleUpscaleUploadedImage() {
    if (!uploadedImage || !uploadedPreview) return;
    const temp = makeUploadedMediaItem();
    temp.url = uploadedPreview;
    // Override with actual file
    const blobUrl = URL.createObjectURL(uploadedImage);
    await handleUpscale({ ...temp, url: blobUrl });
    URL.revokeObjectURL(blobUrl);
  }

  async function handleRemoveBgUploadedImage() {
    if (!uploadedImage || !uploadedPreview) return;
    const blobUrl = URL.createObjectURL(uploadedImage);
    await handleRemoveBg({ ...makeUploadedMediaItem(), url: blobUrl });
    URL.revokeObjectURL(blobUrl);
  }

  // ── Add to Assemble ──────────────────────────────────────────────────────────

  function handleAddToAssemble(img: MediaItem) {
    const store = useStudioStore.getState();
    store.initDefaultTracks();
    const vt = useStudioStore.getState().timelineTracks.find(t => t.type === 'video');
    if (vt) {
      const sorted = [...vt.clips].sort((a, b) => a.startTime - b.startTime);
      const last = sorted.at(-1);
      const startTime = last ? last.startTime + last.duration : 0;
      store.addClipToTrack(vt.id, { type: 'image', startTime, duration: 3, sourceUrl: img.url, prompt: img.prompt });
    } else {
      store.addToTimeline({ type: 'image', url: img.url, prompt: img.prompt });
    }
    setAddedToast(img.id);
    setTimeout(() => setAddedToast(null), 2000);
  }

  // ── Download ─────────────────────────────────────────────────────────────────

  async function handleDownload(img: MediaItem) {
    try {
      // blob: URLs are same-origin; external URLs need proxy to bypass CORS
      const fetchUrl = img.url.startsWith('blob:')
        ? img.url
        : `/api/studio/proxy-image?url=${encodeURIComponent(img.url)}`;
      const blob = await fetch(fetchUrl).then(r => r.blob());
      const ext = img.format ?? (img.type === 'video' ? 'mp4' : 'png');
      const objectUrl = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: objectUrl,
        download: `studio-${Date.now()}.${ext}`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch { /* silent */ }
  }

  // ── Copy prompt ───────────────────────────────────────────────────────────────

  async function handleCopyPrompt(img: MediaItem) {
    try {
      await navigator.clipboard.writeText(img.prompt ?? '');
      setCopyStates(s => ({ ...s, [img.id]: true }));
      setTimeout(() => setCopyStates(s => ({ ...s, [img.id]: false })), 2000);
    } catch { /* silent */ }
  }

  function filterFor(imgId: string) {
    const filterId = imageFilters[imgId] ?? 'original';
    return QUICK_FILTERS.find(f => f.id === filterId)?.filter ?? 'none';
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">

          {/* ── STATE A: no image ─────────────────────────────────────────── */}
          {!uploadedPreview ? (
            <div className="space-y-6">
              {/* Upload drop zone */}
              <div
                onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
                onDrop={handleDrop}
                onClick={() => uploadRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-gray-500"><IconUpload /></span>
                <p className="text-sm text-gray-400">Drop a photo to enhance, or click to upload</p>
                <p className="text-xs text-gray-600">PNG, JPG, WebP</p>
              </div>
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadChange}
              />

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-gray-500">or create from scratch</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Prompt area */}
              <div className="space-y-3">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the image you want to create... (Ctrl+Enter to generate)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500/30 focus:bg-white/[0.08]"
                />

                {/* ── Style chips ─────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2">
                  {STYLE_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      onClick={() => setSelectedStyle(chip.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        selectedStyle === chip.id
                          ? 'border-green-500/40 bg-green-500/10 text-green-400'
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>

                {/* ── Quality tier buttons ─────────────────────────── */}
                {selectionMode === 'simple' && (
                  <div className="flex gap-2">
                    {TIERS.map(tier => (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier.id)}
                        className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-center transition-all ${
                          selectedTier === tier.id
                            ? 'border-green-500/40 bg-green-500/10'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${selectedTier === tier.id ? 'text-green-400' : 'text-white'}`}>
                          {tier.label}
                        </span>
                        <span className="text-xs text-gray-500">{tier.desc}</span>
                        <span className="text-xs text-gray-500">
                          {tier.credits} {tier.credits === 1 ? 'credit' : 'credits'} · {tier.eta}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Controls row: Size + Format + Generate ───────── */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedSize}
                    onChange={e => setSelectedSize(e.target.value as SizePresetId)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 outline-none"
                  >
                    {SIZE_PRESETS.map(s => (
                      <option key={s.id} value={s.id} className="bg-[#0d0d14]">
                        {s.label} — {s.subtitle}
                      </option>
                    ))}
                  </select>

                  <select
                    value={outputFormat}
                    onChange={e => setOutputFormat(e.target.value as OutputFormat)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 outline-none"
                  >
                    {OUTPUT_FORMATS.map(f => (
                      <option key={f} value={f} className="bg-[#0d0d14]">{f.toUpperCase()}</option>
                    ))}
                  </select>

                  <div className="flex-1" />

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <IconSparkle />
                        Create image · {activeCredits} {activeCredits === 1 ? 'credit' : 'credits'}
                      </>
                    )}
                  </button>
                </div>

                {/* ── "More options" toggle ────────────────────────── */}
                <button
                  onClick={() => {
                    const next = !showAdvanced;
                    setShowAdvanced(next);
                    if (!next) setSelectionMode('simple');
                  }}
                  className="text-xs text-gray-500 transition-colors hover:text-gray-300"
                >
                  {showAdvanced ? '▴ Hide options' : '▾ More options'}
                </button>

                {/* ── Advanced panel ───────────────────────────────── */}
                {showAdvanced && (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">Mode:</span>
                      <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
                        <button
                          onClick={() => setSelectionMode('simple')}
                          className={`rounded-md px-3 py-1 text-xs transition-colors ${
                            selectionMode === 'simple' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Auto
                        </button>
                        <button
                          onClick={() => {
                            setSelectionMode('advanced');
                            if (!selectedModel) {
                              const first = generateModels.find(m => m.tier === selectedTier);
                              if (first) setSelectedModel(first.alias);
                            }
                          }}
                          className={`rounded-md px-3 py-1 text-xs transition-colors ${
                            selectionMode === 'advanced' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Pick model
                        </button>
                      </div>
                    </div>

                    {selectionMode === 'advanced' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-500">Model override:</label>
                        <select
                          value={selectedModel}
                          onChange={e => setSelectedModel(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 outline-none"
                        >
                          {(['fast', 'quality', 'premium'] as const).map(tier => {
                            const tierModels = generateModels.filter(m => m.tier === tier);
                            if (tierModels.length === 0) return null;
                            const tierLabel = tier === 'fast' ? '⚡ Quick' : tier === 'quality' ? '✨ Best' : '👑 HD';
                            return (
                              <optgroup key={tier} label={tierLabel}>
                                {tierModels.map(m => (
                                  <option key={m.alias} value={m.alias} className="bg-[#0d0d14]">
                                    {m.displayName} — {m.creditCost} {m.creditCost === 1 ? 'credit' : 'credits'}
                                    {m.byokOnly ? ' (BYOK)' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                          {generateModels.length === 0 && (
                            <option value="img-fast" className="bg-[#0d0d14]">Flux Schnell (Fast)</option>
                          )}
                        </select>
                        <p className="text-xs text-gray-600">
                          Auto mode picks the fastest and cheapest engine for each quality level. Override only if you need a specific model.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Example prompts */}
              {generatedImages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Upload to Inpaint */}
              <div className="flex justify-center">
                <button
                  onClick={() => inpaintInputRef.current?.click()}
                  className="rounded-full border border-purple-500/30 bg-purple-600/10 px-5 py-2 text-sm text-purple-300 transition-colors hover:bg-purple-600/20"
                >
                  Upload photo to Inpaint / Edit
                </button>
              </div>
            </div>

          ) : (
            /* ── STATE B: image uploaded ──────────────────────────────────── */
            <div className="space-y-6">
              <div className="relative mx-auto max-w-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedPreview}
                  alt="Uploaded"
                  className="w-full rounded-xl border border-white/10"
                  style={{ maxHeight: 400, objectFit: 'contain' }}
                />
                <button
                  onClick={clearUpload}
                  className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                >
                  <IconX />
                </button>
              </div>

              <p className="text-center text-sm text-gray-400">What would you like to do?</p>

              <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
                <ActionButton icon="sparkle"  label="Improve"    sublabel="2 credits" onClick={() => setMode('improve')} highlight />
                <ActionButton icon="edit"     label="Edit"       sublabel="2 credits" onClick={() => { if (uploadedPreview) setInpaintImage(uploadedPreview); }} />
                <ActionButton icon="video"    label="Animate"    sublabel="5 credits" onClick={handleAnimateUploadedImage} />
                <ActionButton icon="upscale"  label="Upscale"    sublabel="1 credit"  onClick={handleUpscaleUploadedImage} />
                <ActionButton icon="removebg" label="Remove BG"  sublabel="1 credit"  onClick={handleRemoveBgUploadedImage} />
                <ActionButton icon="download" label="Download"   onClick={() => {
                  if (uploadedPreview) {
                    const a = document.createElement('a');
                    a.href = uploadedPreview;
                    a.download = `photo-${Date.now()}.png`;
                    a.click();
                  }
                }} />
              </div>

              {/* Enhancement presets panel */}
              {mode === 'improve' && (
                <div ref={improvePanelRef} className="mx-auto max-w-lg space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-medium text-gray-300">Choose enhancement style</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ENHANCEMENT_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handleEnhance(preset.id)}
                        disabled={isEnhancing}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          isEnhancing
                            ? 'cursor-not-allowed opacity-50'
                            : 'border-white/10 hover:border-green-500/30 hover:bg-green-500/5'
                        }`}
                      >
                        <div className="font-medium text-white">{preset.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Or describe the improvement:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g. warmer lighting, more contrast..."
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
                      />
                      <button
                        onClick={() => handleEnhance()}
                        disabled={isEnhancing || !prompt.trim()}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        {isEnhancing ? 'Improving...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom edit (default state) */}
              {mode === 'create' && (
                <div className="mx-auto max-w-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="Or type an instruction: 'change the background to...'"
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
                    />
                    <button
                      onClick={() => handleEnhance()}
                      disabled={!prompt.trim() || isEnhancing}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────────────── */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Results grid ───────────────────────────────────────────────── */}
          {generatedImages.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-medium text-gray-400">Results</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isGenerating && (
                  <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
                )}
                {generatedImages.map(img => (
                  <ResultCard
                    key={img.id}
                    img={img}
                    filter={filterFor(img.id)}
                    copied={copyStates[img.id] ?? false}
                    activeFilterId={imageFilters[img.id] ?? 'original'}
                    onFilterChange={filterId => setImageFilters(s => ({ ...s, [img.id]: filterId }))}
                    onOpen={() => setModalImage(img)}
                    onImprove={() => {
                      // Load result back as upload for further improvement
                      fetch(img.url)
                        .then(r => r.blob())
                        .then(blob => {
                          const file = new File([blob], `result-${Date.now()}.webp`, { type: blob.type || 'image/webp' });
                          applyUploadedFile(file);
                          setMode('improve');
                        })
                        .catch(() => {});
                    }}
                    onAnimate={() => {
                      setAnimateTarget(img);
                      setSelectedMotion('cinematic');
                      setCustomMotionPrompt('');
                    }}
                    onUpscale={() => handleUpscale(img)}
                    onRemoveBg={() => handleRemoveBg(img)}
                    onDownload={() => handleDownload(img)}
                    onAddToAssemble={() => handleAddToAssemble(img)}
                    onCopy={() => handleCopyPrompt(img)}
                    onDelete={() => removeImage(img.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Skeleton while generating (no results yet) */}
          {isGenerating && generatedImages.length === 0 && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
              <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
            </div>
          )}

        </div>
      </div>

      {/* ── Animate panel ──────────────────────────────────────────────────── */}
      {animateTarget && (
        <AnimatePanel
          target={animateTarget}
          selectedMotion={selectedMotion}
          onMotionChange={setSelectedMotion}
          duration={animDuration}
          onDurationChange={setAnimDuration}
          customPrompt={customMotionPrompt}
          onCustomPromptChange={setCustomMotionPrompt}
          isAnimating={isAnimating}
          onAnimate={handleInlineAnimate}
          onClose={() => setAnimateTarget(null)}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showUpgrade && (
        <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
      )}
      {modalImage && (
        <ImageDetailModal
          img={modalImage}
          onClose={() => setModalImage(null)}
          onAnimate={() => {
            setModalImage(null);
            setAnimateTarget(modalImage);
            setSelectedMotion('cinematic');
            setCustomMotionPrompt('');
          }}
          onAddToAssemble={() => handleAddToAssemble(modalImage)}
          onDownload={() => handleDownload(modalImage)}
          onCopy={() => handleCopyPrompt(modalImage)}
          onInpaintResult={(url: string) => {
            addImage({
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'image', url,
              prompt: `[Inpainted] ${modalImage.prompt ?? ''}`,
              preset: modalImage.preset,
              format: modalImage.format ?? 'webp',
              model: 'flux-fill-pro',
              createdAt: Date.now(),
            });
            setModalImage(null);
          }}
          galleryImages={generatedImages.filter(i => i.type === 'image').map(i => i.url)}
        />
      )}
      {inpaintImage && (
        <InpaintEditor
          imageUrl={inpaintImage}
          onClose={() => { URL.revokeObjectURL(inpaintImage); setInpaintImage(null); }}
          onResult={(url) => {
            addImage({
              id: crypto.randomUUID(),
              type: 'image', url,
              prompt: '[Inpainted upload]',
              model: 'flux-fill-pro',
              createdAt: Date.now(),
            });
            URL.revokeObjectURL(inpaintImage);
            setInpaintImage(null);
          }}
        />
      )}

      {/* Hidden inpaint input */}
      <input
        ref={inpaintInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file || !file.type.startsWith('image/')) return;
          setInpaintImage(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />

      {/* Added to timeline toast */}
      {addedToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-950/90 px-4 py-3 text-sm text-green-300 shadow-xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Added to Assemble timeline
        </div>
      )}
    </div>
  );
}
