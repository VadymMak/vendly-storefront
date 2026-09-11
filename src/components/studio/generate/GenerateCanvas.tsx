'use client';

import { useState, useRef, useCallback, type ChangeEvent, type KeyboardEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import UpgradeModal from '@/components/studio/UpgradeModal';
import { ImageDetailModal } from './ImageDetailModal';
import {
  PRESET_MAP, STYLE_TAGS, ENHANCE_MODES, OUTPUT_FORMATS, QUICK_FILTERS, FLUX_MODELS, EXAMPLE_PROMPTS,
  type PresetKey, type OutputFormat, type FluxModel,
} from '@/lib/studio/constants';
import { saveToLibrary } from '@/lib/studio/library-store';
import { useStudioStore, type MediaItem } from '@/lib/studio/store';
import { AccordionSection } from '@/components/studio/AccordionSection';

interface Props {
  userId: string;
  userEmail: string;
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function GenerateCanvas({ userId: _userId }: Props) {
  const router = useRouter();

  // Store
  const generatedImages = useStudioStore((s) => s.generatedImages);
  const addImage = useStudioStore((s) => s.addImage);
  const removeImage = useStudioStore((s) => s.removeImage);

  // Prompt
  const [prompt, setPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Controls
  const [selectedModel, setSelectedModel] = useState<FluxModel>('schnell');
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('product');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('webp');
  const [enhanceMode, setEnhanceMode] = useState('product');
  const [activeStyleTags, setActiveStyleTags] = useState<Set<string>>(new Set());

  // Reference image
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [refDragOver, setRefDragOver] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [modalImage, setModalImage] = useState<MediaItem | null>(null);
  const [imageFilters, setImageFilters] = useState<Record<string, string>>({});
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({});
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // ── Reference image handlers ───────────────────────────────────────────────

  function applyReferenceFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setReferenceImage(file);
    setReferencePreview(URL.createObjectURL(file));
  }

  function handleRefInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyReferenceFile(file);
  }

  function handleRefDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setRefDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) applyReferenceFile(file);
  }

  function clearReference() {
    setReferenceImage(null);
    setReferencePreview(null);
    if (refInputRef.current) refInputRef.current.value = '';
  }

  // ── Style tag toggle ──────────────────────────────────────────────────────

  function toggleTag(tag: string) {
    setActiveStyleTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  // ── Enhance prompt ────────────────────────────────────────────────────────

  async function handleEnhancePrompt() {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, enhanceMode, styleTags: [...activeStyleTags] }),
      });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok || !data.enhanced) throw new Error(data.error ?? 'Enhancement failed');
      setEnhancedPrompt(data.enhanced);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed');
    } finally {
      setIsEnhancing(false);
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const finalPrompt = (enhancedPrompt ?? prompt).trim();
    if (!finalPrompt || isGenerating) return;
    const preset = PRESET_MAP[selectedPreset];
    setIsGenerating(true);
    setError(null);

    try {
      let url: string;

      if (referenceImage) {
        // With reference image → generate-with-reference
        const fd = new FormData();
        fd.append('prompt', finalPrompt);
        fd.append('referenceImage', referenceImage);
        fd.append('aspectRatio', preset.aspect_ratio);
        fd.append('strength', '0.75');
        const res = await fetch('/api/studio/generate-with-reference', { method: 'POST', body: fd });
        if (!res.ok) {
          const e = await res.json() as { error?: string; needsUpgrade?: boolean };
          if (e.needsUpgrade) { setShowUpgrade(true); return; }
          throw new Error(e.error ?? 'Generation failed');
        }
        const data = await res.json() as { url: string };
        url = data.url;
      } else {
        // Without reference → /api/generate-image (returns blob)
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: finalPrompt,
            aspect_ratio: preset.aspect_ratio,
            megapixels: preset.megapixels,
            target_width: preset.target_width,
            target_height: preset.target_height,
            output_format: outputFormat,
          }),
        });
        if (!res.ok) {
          const e = await res.json() as { error?: string; needsUpgrade?: boolean };
          if (e.needsUpgrade) { setShowUpgrade(true); return; }
          throw new Error(e.error ?? 'Generation failed');
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
      }

      const newImage: MediaItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image',
        url,
        prompt: finalPrompt,
        preset: selectedPreset,
        format: outputFormat,
        model: selectedModel,
        createdAt: Date.now(),
      };
      addImage(newImage);
      saveToLibrary({ type: 'image', url, prompt: finalPrompt, model: selectedModel, preset: selectedPreset });

      // Track generation + refresh credits
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
  }, [prompt, enhancedPrompt, isGenerating, selectedPreset, outputFormat, selectedModel, referenceImage]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  }

  // ── Animate → ─────────────────────────────────────────────────────────────

  async function handleAnimate(img: MediaItem) {
    let publicUrl = img.url;
    try {
      if (img.url.startsWith('blob:')) {
        const blob = await fetch(img.url).then(r => r.blob());
        const file = new File([blob], `studio-${Date.now()}.webp`, { type: blob.type || 'image/webp' });
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        publicUrl = data.url!;
      }
      router.push(`/studio/animate?image=${encodeURIComponent(publicUrl)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare image for animation');
    }
  }

  // ── Add to Assemble ───────────────────────────────────────────────────────

  function handleAddToAssemble(img: MediaItem) {
    const store = useStudioStore.getState();
    store.initDefaultTracks();
    const vt = useStudioStore.getState().timelineTracks.find(t => t.type === 'video');
    if (vt) {
      const sorted = [...vt.clips].sort((a, b) => a.startTime - b.startTime);
      const last = sorted.at(-1);
      const startTime = last ? last.startTime + last.duration : 0;
      store.addClipToTrack(vt.id, {
        type: 'image',
        startTime,
        duration: 3,
        sourceUrl: img.url,
        prompt: img.prompt,
      });
    } else {
      store.addToTimeline({ type: 'image', url: img.url, prompt: img.prompt });
    }
    setAddedToast(img.id);
    setTimeout(() => setAddedToast(null), 2000);
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload(img: MediaItem) {
    try {
      const blob = await fetch(img.url).then(r => r.blob());
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `studio-${Date.now()}.${img.format}`,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* silent */ }
  }

  // ── Copy prompt ───────────────────────────────────────────────────────────

  async function handleCopyPrompt(img: MediaItem) {
    try {
      await navigator.clipboard.writeText(img.prompt ?? '');
      setCopyStates(s => ({ ...s, [img.id]: true }));
      setTimeout(() => setCopyStates(s => ({ ...s, [img.id]: false })), 2000);
    } catch { /* silent */ }
  }

  function handleDelete(img: MediaItem) {
    removeImage(img.id);
  }

  // ── Filter for image card ─────────────────────────────────────────────────

  function filterFor(imgId: string) {
    const filterId = imageFilters[imgId] ?? 'original';
    return QUICK_FILTERS.find(f => f.id === filterId)?.filter ?? 'none';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Prompt bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/10 bg-[#0a0a0f] p-4">
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={enhancedPrompt ?? prompt}
              onChange={e => {
                if (enhancedPrompt) {
                  setEnhancedPrompt(e.target.value);
                } else {
                  setPrompt(e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe the image you want to generate… (Ctrl+Enter to generate)"
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-white/20 focus:bg-white/8"
            />
            {enhancedPrompt && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400">✓ Enhanced prompt</span>
                <button
                  onClick={() => { setEnhancedPrompt(null); }}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  Use original
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !(enhancedPrompt ?? prompt).trim()}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </span>
              ) : (
                <>
                  <IconSparkle />
                  Generate
                  <span className="text-xs font-normal opacity-70">~1 credit</span>
                </>
              )}
            </button>
            <button
              onClick={handleEnhancePrompt}
              disabled={isEnhancing || !prompt.trim()}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              {isEnhancing ? 'Enhancing…' : '✨ Enhance'}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* ── Body: left settings + results grid ─────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left settings panel with accordion sections */}
        <aside className="hidden w-[240px] flex-shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#0d0d14] lg:flex">
          <AccordionSection title="Model" defaultOpen>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value as FluxModel)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              {FLUX_MODELS.map(m => (
                <option key={m.value} value={m.value} className="bg-[#0d0d14]">
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
          </AccordionSection>

          <AccordionSection title="Preset" defaultOpen>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(PRESET_MAP) as PresetKey[]).map(key => {
                const p = PRESET_MAP[key];
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedPreset(key)}
                    className={[
                      'rounded-lg border px-2 py-2 text-left text-xs transition-colors',
                      selectedPreset === key
                        ? 'border-green-600/60 bg-green-600/10 text-white'
                        : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                    ].join(' ')}
                  >
                    <div className="font-medium">{p.label}</div>
                    <div className="text-gray-500">{p.display}</div>
                  </button>
                );
              })}
            </div>
          </AccordionSection>

          <AccordionSection title="Format">
            <div className="flex gap-1.5">
              {OUTPUT_FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setOutputFormat(f)}
                  className={[
                    'flex-1 rounded-lg border py-1.5 text-xs font-medium uppercase transition-colors',
                    outputFormat === f
                      ? 'border-green-600/60 bg-green-600/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="Style Tags">
            <div className="flex flex-wrap gap-1.5">
              {STYLE_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    activeStyleTags.has(tag)
                      ? 'border-green-600/60 bg-green-600/10 text-green-400'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {tag}
                </button>
              ))}
            </div>
            {activeStyleTags.size > 0 && (
              <button
                onClick={() => setActiveStyleTags(new Set())}
                className="mt-2 text-xs text-gray-500 hover:text-white"
              >
                Clear all
              </button>
            )}
          </AccordionSection>

          <AccordionSection title="Enhance Mode">
            <select
              value={enhanceMode}
              onChange={e => setEnhanceMode(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              {ENHANCE_MODES.map(m => (
                <option key={m.value} value={m.value} className="bg-[#0d0d14]">
                  {m.label}
                </option>
              ))}
            </select>
          </AccordionSection>

          <AccordionSection title="Reference Image">
            {referencePreview ? (
              <div className="relative overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referencePreview} alt="Reference" className="w-full object-cover" style={{ maxHeight: 140 }} />
                <button
                  onClick={clearReference}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setRefDragOver(true); }}
                onDragLeave={() => setRefDragOver(false)}
                onDrop={handleRefDrop}
                onClick={() => refInputRef.current?.click()}
                className={[
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                  refDragOver
                    ? 'border-green-600/50 bg-green-600/5'
                    : 'border-white/10 hover:border-white/20',
                ].join(' ')}
              >
                <IconUpload />
                <p className="text-xs text-gray-400">Drop or click to upload</p>
                <p className="text-xs text-gray-600">PNG, JPG, WebP</p>
              </div>
            )}
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleRefInputChange}
            />
          </AccordionSection>
        </aside>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isGenerating && generatedImages.length === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1].map(i => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          )}

          {generatedImages.length === 0 && !isGenerating && (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div>
                <p className="mb-1 text-lg font-medium text-gray-300">Enter a prompt to generate images</p>
                <p className="text-sm text-gray-500">Or try one of these examples:</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPrompt(p)}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-white/20 hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {generatedImages.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isGenerating && (
                <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
              )}
              {generatedImages.map(img => (
                <ImageCard
                  key={img.id}
                  img={img}
                  filter={filterFor(img.id)}
                  copied={copyStates[img.id] ?? false}
                  onOpen={() => setModalImage(img)}
                  onAnimate={() => handleAnimate(img)}
                  onAddToAssemble={() => handleAddToAssemble(img)}
                  onDownload={() => handleDownload(img)}
                  onCopy={() => handleCopyPrompt(img)}
                  onDelete={() => handleDelete(img)}
                  onFilterChange={filterId => setImageFilters(s => ({ ...s, [img.id]: filterId }))}
                  activeFilterId={imageFilters[img.id] ?? 'original'}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showUpgrade && <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />}
      {modalImage && (
        <ImageDetailModal
          img={modalImage}
          onClose={() => setModalImage(null)}
          onAnimate={() => { setModalImage(null); handleAnimate(modalImage); }}
          onAddToAssemble={() => handleAddToAssemble(modalImage)}
          onDownload={() => handleDownload(modalImage)}
          onCopy={() => handleCopyPrompt(modalImage)}
        />
      )}
      {/* Added to timeline toast */}
      {addedToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-950/90 px-4 py-3 text-sm text-green-300 shadow-xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          Added to Assemble timeline
        </div>
      )}
    </div>
  );
}

// ── ImageCard ────────────────────────────────────────────────────────────────

interface ImageCardProps {
  img: MediaItem;
  filter: string;
  copied: boolean;
  activeFilterId: string;
  onOpen: () => void;
  onAnimate: () => void;
  onAddToAssemble: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onFilterChange: (id: string) => void;
}

function ImageCard({ img, filter, copied, activeFilterId, onOpen, onAnimate, onAddToAssemble, onDownload, onCopy, onDelete, onFilterChange }: ImageCardProps) {
  const preset = PRESET_MAP[img.preset as PresetKey] ?? Object.values(PRESET_MAP)[0];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-white/20">
      {/* Image */}
      <div className="relative cursor-pointer overflow-hidden" onClick={onOpen}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.prompt ?? ''}
          className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          style={{ filter: filter !== 'none' ? filter : undefined }}
        />
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-gray-300 opacity-0 transition-opacity hover:bg-red-600/80 hover:text-white group-hover:opacity-100"
          aria-label="Delete image"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Info + actions */}
      <div className="p-3">
        <p className="mb-2 line-clamp-2 text-xs text-gray-400">{img.prompt}</p>

        {/* Quick filters */}
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {QUICK_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={[
                'flex-shrink-0 rounded px-2 py-0.5 text-xs transition-colors',
                activeFilterId === f.id
                  ? 'bg-white/15 text-white'
                  : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={onAnimate}
            className="flex items-center gap-1 rounded-md bg-green-600/20 px-2.5 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30"
          >
            <IconPlay /> Animate →
          </button>
          <button
            onClick={onAddToAssemble}
            className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
          >
            <IconLayers /> Assemble
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
          >
            <IconDownload />
          </button>
          <button
            onClick={onCopy}
            className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
          >
            <IconCopy />
            {copied ? <span className="text-green-400">✓</span> : null}
          </button>
        </div>

        {/* Metadata */}
        <p className="mt-2 text-xs text-gray-600">
          {preset.label} · {preset.display} · {img.format?.toUpperCase()} · Flux {img.model}
        </p>
      </div>
    </div>
  );
}

