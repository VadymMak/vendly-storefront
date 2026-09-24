'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useStudioStore, type MediaItem } from '@/lib/studio/store';
import {
  EXAMPLE_PROMPTS, SIZE_PRESETS, OUTPUT_FORMATS, STYLE_CHIPS,
  type OutputFormat, type SizePresetId, type StyleChipId,
  type PresetKey, PRESET_MAP,
} from '@/lib/studio/constants';
import { type ModelTier } from '@/lib/studio/config';
import CreditPackModal from '@/components/studio/CreditPackModal';
import PricingModal from '@/components/studio/PricingModal';
import { InpaintEditor } from '@/components/studio/editors/InpaintEditor';
import { PlaceProductsEditor } from '@/components/studio/editors/PlaceProductsEditor';
import { ImproveEditor } from '@/components/studio/editors/ImproveEditor';
import { RemoveBgEditor } from '@/components/studio/editors/RemoveBgEditor';
import { UpscaleEditor } from '@/components/studio/editors/UpscaleEditor';
import { AnimateEditor } from '@/components/studio/editors/AnimateEditor';
import { GenerateVideoEditor } from '@/components/studio/editors/GenerateVideoEditor';
import { ImageDetailModal } from '@/components/studio/generate/ImageDetailModal';
import { VideoDetailModal } from '@/components/studio/generate/VideoDetailModal';

// ── Quick tool config ─────────────────────────────────────────────────────────

interface QuickTool {
  id: 'improve' | 'remove-bg' | 'upscale' | 'animate' | 'inpaint' | 'place-products' | 'generate-video';
  label: string;
  description: string;
  credits: string;
  iconSvg: string;
  /** true = tool opens directly without file picker */
  noImage?: boolean;
}

const QUICK_TOOLS: QuickTool[] = [
  {
    id: 'improve',
    label: 'Improve Photo',
    description: 'Enhance lighting, clarity, and detail',
    credits: '2 credits',
    iconSvg: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  },
  {
    id: 'remove-bg',
    label: 'Remove Background',
    description: 'Isolate subject with clean cutout',
    credits: '1 credit',
    iconSvg: 'M6 6a3 3 0 100-6 3 3 0 000 6zM6 18a3 3 0 100-6 3 3 0 000 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12',
  },
  {
    id: 'upscale',
    label: 'Upscale HD',
    description: 'Boost resolution up to 4x',
    credits: '1 credit',
    iconSvg: 'M15 3l6 0 0 6M9 21l-6 0 0-6M21 3l-7 7M3 21l7-7',
  },
  {
    id: 'animate',
    label: 'Animate Video',
    description: 'Turn image into short video',
    credits: '5 credits',
    iconSvg: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    id: 'inpaint',
    label: 'Edit & Replace',
    description: 'Paint over areas to change or remove',
    credits: '2 credits',
    iconSvg: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  },
  {
    id: 'place-products',
    label: 'Place Products',
    description: 'Composite cutouts into scenes',
    credits: 'Free',
    iconSvg: 'M3 3h18v18H3zM15 9a4 4 0 11-8 0 4 4 0 018 0zM3 21l6-6',
  },
  {
    id: 'generate-video',
    label: 'Generate Video',
    description: 'Text-to-video with Grok AI',
    credits: '8 credits',
    iconSvg: 'M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1V5z',
    noImage: true,
  },
];

type CreateViewState = 'form' | 'creating' | 'result';

interface Props {
  userId: string;
  userEmail: string;
}

export function StudioHome({ userId: _userId }: Props) {
  const router = useRouter();

  // ── Store ───────────────────────────────────────────────────────────────────
  const generatedImages = useStudioStore((s) => s.generatedImages);
  const addImage        = useStudioStore((s) => s.addImage);
  const removeImage     = useStudioStore((s) => s.removeImage);

  // ── Saved toast ─────────────────────────────────────────────────────────────
  const [showSavedToast, setShowSavedToast] = useState(false);
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showSaved() {
    setShowSavedToast(true);
    if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
    savedToastTimer.current = setTimeout(() => setShowSavedToast(false), 3000);
  }

  // ── Create view state machine ────────────────────────────────────────────────
  const [createView, setCreateView] = useState<CreateViewState>('form');
  const [latestResult, setLatestResult] = useState<{
    url: string;
    prompt: string;
    model: string;
    provider: string;
    tier: string;
    credits: number;
    type?: 'image' | 'video';
    jobId?: string;
  } | null>(null);

  // ── Active editor state ─────────────────────────────────────────────────────
  const [activeEditor, setActiveEditor] = useState<{
    tool: 'improve' | 'remove-bg' | 'upscale' | 'animate' | 'inpaint';
    imageUrl: string;
    imageFile: File;
  } | null>(null);

  const [showGenerateVideo, setShowGenerateVideo] = useState(false);

  const [createSlow, setCreateSlow] = useState(false);

  const [showPlaceProducts, setShowPlaceProducts] = useState(false);
  const [placeProductsBgUrl, setPlaceProductsBgUrl] = useState<string | null>(null);

  // ── Upload state (for Quick Tools) ──────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingToolRef = useRef<QuickTool['id'] | null>(null);

  // ── Create (text-to-image) state ────────────────────────────────────────────
  const [prompt,          setPrompt]          = useState('');
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [selectedStyle,   setSelectedStyle]   = useState<StyleChipId>('custom');
  const [selectedTier,    setSelectedTier]    = useState<ModelTier>('quality');
  const [selectedSize,    setSelectedSize]    = useState<SizePresetId>('instagram');
  const [outputFormat,    setOutputFormat]    = useState<OutputFormat>('webp');
  const [error,           setError]           = useState<string | null>(null);
  const [showAdvanced,    setShowAdvanced]    = useState(false);

  // ── Credits ─────────────────────────────────────────────────────────────────
  interface CreditStatus {
    plan: string;
    superuser?: boolean;
    byok: boolean;
    monthly: { images: { remaining: number }; videos: { remaining: number } };
    bonus: { images: number; videos: number };
  }
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [showCreditPack, setShowCreditPack] = useState(false);
  const [creditPackReason, setCreditPackReason] = useState<'video' | 'tier' | 'credits'>('credits');
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  // ── Dynamic model catalog ───────────────────────────────────────────────────
  interface CatalogModel {
    alias: string;
    displayName: string;
    provider: string;
    operation: string;
    tier: string;
    creditCost: number;
    creditType: string;
    byokOnly: boolean;
  }
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);

  useEffect(() => {
    fetch('/api/studio/models')
      .then(r => r.json())
      .then((data: { models: CatalogModel[] }) => setCatalogModels(data.models))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/studio/credits')
      .then(r => r.ok ? r.json() : null)
      .then((data: CreditStatus | null) => { if (data) setCreditStatus(data); })
      .catch(() => {});
  }, []);

  // Handle Stripe redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setCheckoutSuccess(params.get('pack') ?? 'credits');
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setCheckoutSuccess(null), 5000);
    }
    if (params.get('subscription') === 'success') {
      setCheckoutSuccess(`subscription:${params.get('plan') ?? 'plan'}`);
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setCheckoutSuccess(null), 5000);
    }
  }, []);

  const isFreePlan = creditStatus
    ? (creditStatus.plan === 'free' && !creditStatus.superuser && !creditStatus.byok &&
       !(creditStatus.bonus.images > 0 || creditStatus.bonus.videos > 0))
    : false;

  const noCreditsForImages = creditStatus
    ? (!creditStatus.superuser && !creditStatus.byok &&
       (creditStatus.monthly.images.remaining + creditStatus.bonus.images) <= 0)
    : false;

  useEffect(() => {
    if (isFreePlan && selectedTier !== 'fast') setSelectedTier('fast');
  }, [isFreePlan, selectedTier]);

  const TIERS: { id: ModelTier; label: string; desc: string; credits: number; eta: string }[] = [
    { id: 'fast',    label: 'Quick', desc: 'Fast draft',      credits: 1, eta: '~3s'  },
    { id: 'quality', label: 'Best',  desc: 'Recommended',     credits: 2, eta: '~8s'  },
    { id: 'premium', label: 'HD',    desc: 'Highest detail',  credits: 3, eta: '~15s' },
  ];

  const activeTierCredits = TIERS.find(t => t.id === selectedTier)?.credits ?? 1;

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [modalImage, setModalImage] = useState<MediaItem | null>(null);
  const [modalVideo, setModalVideo] = useState<MediaItem | null>(null);

  // ── Mobile tab ──────────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<'create' | 'edit'>('create');

  // ── Upload for drag-and-drop on Hero ────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, []);

  // ── Quick Tool click → open file picker → open editor ──────────────────────

  function handleQuickToolClick(toolId: QuickTool['id']) {
    if (toolId === 'generate-video') {
      setShowGenerateVideo(true);
      return;
    }
    if (toolId === 'place-products') {
      pendingToolRef.current = 'place-products';
      fileInputRef.current?.click();
      return;
    }
    pendingToolRef.current = toolId;
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const toolId = pendingToolRef.current;
    if (!toolId) return;

    const url = URL.createObjectURL(file);

    if (toolId === 'place-products') {
      setPlaceProductsBgUrl(url);
      setShowPlaceProducts(true);
    } else {
      setActiveEditor({
        tool: toolId as 'improve' | 'remove-bg' | 'upscale' | 'animate' | 'inpaint',
        imageUrl: url,
        imageFile: file,
      });
    }

    pendingToolRef.current = null;
    e.target.value = '';
  }

  // ── Hero Upload (Edit a photo) ──────────────────────────────────────────────

  const heroUploadRef = useRef<HTMLInputElement>(null);

  function handleHeroUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setActiveEditor({ tool: 'improve', imageUrl: url, imageFile: file });
    e.target.value = '';
  }

  function handleHeroDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setActiveEditor({ tool: 'improve', imageUrl: url, imageFile: file });
  }

  // ── Generate (text-to-image) ────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt || isGenerating) return;

    if (noCreditsForImages) {
      setCreditPackReason('credits');
      setShowCreditPack(true);
      return;
    }

    const size = SIZE_PRESETS.find(s => s.id === selectedSize) ?? SIZE_PRESETS[0];
    setIsGenerating(true);
    setCreateView('creating');
    setError(null);

    try {
      const styleChip = STYLE_CHIPS.find(s => s.id === selectedStyle);
      const styledPrompt = styleChip?.promptPrefix
        ? `${styleChip.promptPrefix} ${finalPrompt}`
        : finalPrompt;

      const tierObj = TIERS.find(t => t.id === selectedTier);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);

      let res: Response;
      try {
        res = await fetch('/api/studio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: styledPrompt,
            tier: selectedTier,
            aspect_ratio: size.aspect_ratio,
            format: outputFormat,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          throw new Error('Generation timed out. Please try again.');
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);

      if (!res.ok) {
        const e = await res.json() as { error?: string; needsUpgrade?: boolean };
        if (e.needsUpgrade) {
          setCreditPackReason('tier');
          setShowCreditPack(true);
          return;
        }
        throw new Error(e.error ?? 'Generation failed');
      }

      // API returns binary image, NOT JSON
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Read model info from response headers
      const modelAlias    = res.headers.get('X-Model-Alias') ?? '';
      const modelProvider = res.headers.get('X-Model-Provider') ?? '';
      const modelName     = res.headers.get('X-Model-Name') ?? '';
      const modelLabel    = modelName || tierObj?.label || 'unknown';
      void modelAlias;

      const newImage: MediaItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'image',
        url,
        prompt: `[Generated] ${finalPrompt.slice(0, 100)}`,
        preset: selectedSize as PresetKey,
        format: outputFormat,
        model: modelLabel,
        provider: modelProvider,
        createdAt: Date.now(),
      };
      addImage(newImage);
      showSaved();

      setLatestResult({
        url,
        prompt: finalPrompt,
        model: modelLabel,
        provider: modelProvider,
        tier: tierObj?.label ?? 'Quick',
        credits: tierObj?.credits ?? 1,
      });
      setCreateView('result');
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setCreateView('form');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isGenerating, noCreditsForImages, selectedSize, selectedStyle, selectedTier, outputFormat, addImage, catalogModels]);

  useEffect(() => {
    if (createView !== 'creating') {
      setCreateSlow(false);
      return;
    }
    const timer = setTimeout(() => setCreateSlow(true), 15_000);
    return () => clearTimeout(timer);
  }, [createView]);

  // ── Load recent work from server on mount ────────────────────────────────────
  useEffect(() => {
    if (generatedImages.length > 0) return;

    let cancelled = false;
    async function loadRecent() {
      try {
        const res = await fetch('/api/studio/my-work?limit=4');
        if (!res.ok || cancelled) return;
        const data = await res.json() as {
          items?: Array<{
            id: string;
            type: 'image' | 'video';
            url: string;
            prompt?: string;
            model?: string;
            style?: string;
            operation?: string;
            createdAt?: string;
          }>;
        };
        if (cancelled || !data.items?.length) return;
        for (const item of data.items.reverse()) {
          addImage({
            id:        item.id,
            type:      item.type,
            url:       item.url,
            prompt:    item.prompt ?? '',
            model:     item.model,
            createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
          });
        }
      } catch { /* not critical */ }
    }
    loadRecent();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Download helper ─────────────────────────────────────────────────────────

  function handleDownload(img: MediaItem) {
    const ext = img.type === 'video' ? 'mp4' : (img.format ?? 'webp');
    const filename = `studio-${img.type}-${Date.now()}.${ext}`;

    // External video URLs need proxy to bypass CORS
    if (img.type === 'video' && img.url && !img.url.startsWith('blob:') && !img.url.startsWith('/')) {
      if (img.jobId) {
        window.location.assign(`/api/studio/download-video?jobId=${encodeURIComponent(img.jobId)}`);
      } else {
        window.location.assign(`/api/studio/proxy-image?url=${encodeURIComponent(img.url)}&download=${encodeURIComponent(filename)}`);
      }
      return;
    }

    const a = document.createElement('a');
    a.href = img.url;
    a.download = filename;
    a.click();
  }

  // ── Open editor from result card ────────────────────────────────────────────

  function openEditorFromResult(img: MediaItem, tool: 'improve' | 'remove-bg' | 'upscale' | 'animate' | 'inpaint') {
    const fetchUrl = img.url.startsWith('blob:')
      ? img.url
      : `/api/studio/proxy-media?url=${encodeURIComponent(img.url)}`;
    fetch(fetchUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `studio-${Date.now()}.png`, { type: blob.type || 'image/png' });
        setActiveEditor({ tool, imageUrl: img.url, imageFile: file });
      })
      .catch(() => {});
  }

  // ── Open latest result in editor ────────────────────────────────────────────

  function openResultInEditor(tool: 'improve' | 'remove-bg' | 'upscale' | 'animate' | 'inpaint') {
    if (!latestResult) return;
    const fetchUrl = latestResult.url.startsWith('blob:')
      ? latestResult.url
      : `/api/studio/proxy-media?url=${encodeURIComponent(latestResult.url)}`;
    fetch(fetchUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `studio-${Date.now()}.png`, { type: blob.type || 'image/png' });
        setActiveEditor({ tool, imageUrl: latestResult.url, imageFile: file });
      })
      .catch(() => {});
  }

  // ── Recent work (last 8) ────────────────────────────────────────────────────

  const recentImages = generatedImages.slice(0, 4);

  // ── Editor result handlers ──────────────────────────────────────────────────

  function handleEditorResult(resultUrl: string, resultPrompt: string, model: string) {
    addImage({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'image',
      url: resultUrl,
      prompt: resultPrompt,
      format: 'png',
      model,
      createdAt: Date.now(),
    });
    showSaved();
    (window as unknown as Record<string, () => void>).__refreshCredits?.();
  }

  // ── Suppress unused removeImage warning ────────────────────────────────────
  void removeImage;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-full bg-[#0a0a0f] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* ── Mobile tab switcher ──────────────────────────────────────────── */}
        <div className="flex md:hidden rounded-xl bg-white/[0.03] border border-white/10 p-1">
          <button
            onClick={() => setMobileTab('create')}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'create'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ✨ Create New
          </button>
          <button
            onClick={() => setMobileTab('edit')}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'edit'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📷 Edit Photo
          </button>
        </div>

        {/* ── Hero: Create + Upload ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">

          {/* Card A: Create from scratch */}
          <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 flex flex-col gap-4 ${
            mobileTab === 'edit' ? 'hidden md:flex' : 'flex'
          }`}>

            {/* ── STATE: FORM ──────────────────────────────────────────────── */}
            {createView === 'form' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                    Create an image
                  </h2>
                  <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    Text-to-Image
                  </span>
                </div>

                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleGenerate(); } }}
                  placeholder="Describe what you want to create..."
                  className="w-full h-24 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/40 transition-colors resize-none"
                />

                {/* Style chips */}
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      onClick={() => setSelectedStyle(chip.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selectedStyle === chip.id
                          ? 'border-green-500/40 bg-green-500/10 text-green-400'
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="mr-1">{chip.icon}</span>
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Quality tiers — ALWAYS visible */}
                <div className="flex gap-2">
                  {TIERS.map(tier => {
                    const locked = isFreePlan && tier.id !== 'fast';
                    return (
                      <button
                        key={tier.id}
                        disabled={locked}
                        onClick={() => {
                          if (locked) { setCreditPackReason('tier'); setShowCreditPack(true); return; }
                          setSelectedTier(tier.id);
                        }}
                        className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all ${
                          locked
                            ? 'cursor-not-allowed border-white/5 opacity-40'
                            : selectedTier === tier.id
                            ? 'border-green-500/40 bg-green-500/10'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className={`text-xs font-semibold ${selectedTier === tier.id && !locked ? 'text-green-400' : 'text-white'}`}>
                          {tier.label}
                          {locked && <span className="ml-1 text-[10px]">🔒</span>}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {tier.credits} cr · {tier.eta}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* More options toggle */}
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className="flex items-center gap-1.5 self-start text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  More options
                </button>

                {showAdvanced && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={selectedSize} onChange={e => setSelectedSize(e.target.value as SizePresetId)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 outline-none">
                      {SIZE_PRESETS.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#0d0d14]">{s.label} — {s.subtitle}</option>
                      ))}
                    </select>
                    <select value={outputFormat} onChange={e => setOutputFormat(e.target.value as OutputFormat)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 outline-none">
                      {OUTPUT_FORMATS.map(f => (
                        <option key={f} value={f} className="bg-[#0d0d14]">{f.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Generate button */}
                <div className="pt-1 border-t border-white/[0.06]">
                  <button
                    onClick={noCreditsForImages ? () => setShowCreditPack(true) : () => void handleGenerate()}
                    disabled={isGenerating || (!noCreditsForImages && !prompt.trim())}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      noCreditsForImages ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {noCreditsForImages ? 'No credits · Buy more' : <>Create · {activeTierCredits} cr</>}
                  </button>
                </div>

                {/* Example prompts */}
                {generatedImages.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {EXAMPLE_PROMPTS.slice(0, 4).map(p => (
                      <button key={p} onClick={() => setPrompt(p)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-gray-500 transition-colors hover:border-white/20 hover:text-gray-300">
                        {p.length > 40 ? p.slice(0, 37) + '...' : p}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}
              </>
            )}

            {/* ── STATE: CREATING ───────────────────────────────────────────── */}
            {createView === 'creating' && (
              <div className="flex flex-col items-center justify-center gap-5 py-6" style={{ animation: 'fadeSlideUp 200ms ease-out' }}>
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                    {createSlow ? 'Taking longer than expected...' : 'Creating your image...'}
                  </h2>
                  <span className="text-[10px] text-green-400/70 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    {TIERS.find(t => t.id === selectedTier)?.eta ?? '~5s'}
                  </span>
                </div>

                {/* Skeleton preview with visible shimmer */}
                <div className="relative w-full aspect-[4/3] max-h-[280px] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent bg-[length:200%_100%]"
                    style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${
                      createSlow
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-green-500/10 border-green-500/20'
                    }`}>
                      {createSlow ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 animate-pulse" aria-hidden="true">
                          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {createSlow ? 'AI provider is busy, please wait...' : 'AI is generating your image...'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center px-2 line-clamp-2">
                  &ldquo;{prompt}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  {createSlow && (
                    <button
                      onClick={() => {
                        setCreateView('form');
                        setIsGenerating(false);
                        setTimeout(() => void handleGenerate(), 300);
                      }}
                      className="text-xs text-green-400 hover:text-green-300 font-medium underline transition-colors"
                    >
                      Try again
                    </button>
                  )}
                  <button
                    onClick={() => { setCreateView('form'); setIsGenerating(false); }}
                    className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── STATE: RESULT ─────────────────────────────────────────────── */}
            {createView === 'result' && latestResult && (
              <div className="flex flex-col gap-4" style={{ animation: 'fadeSlideUp 200ms ease-out' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    {latestResult.type === 'video' ? 'Your video is ready' : 'Your image is ready'}
                  </h2>
                  {latestResult.credits > 0 && (
                    <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {latestResult.tier} · {latestResult.credits} cr
                    </span>
                  )}
                </div>

                {/* Preview — click opens detail modal */}
                <button
                  onClick={() => {
                    const match = generatedImages.find(img => img.url === latestResult.url);
                    if (!match) return;
                    if (latestResult.type === 'video') setModalVideo(match);
                    else setModalImage(match);
                  }}
                  className="relative w-full rounded-xl overflow-hidden bg-black/40 border border-white/10 group cursor-pointer"
                >
                  {latestResult.type === 'video' ? (
                    /* eslint-disable-next-line jsx-a11y/media-has-caption */
                    <video
                      src={latestResult.url}
                      autoPlay loop muted playsInline
                      className="w-full max-h-[320px] object-contain"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={latestResult.url}
                      alt="Generated result"
                      className="w-full max-h-[320px] object-contain"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-70 transition-opacity" aria-hidden="true">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </div>
                </button>

                <p className="text-xs text-gray-400 line-clamp-2">
                  &ldquo;{latestResult.prompt}&rdquo;
                </p>

                {latestResult.type === 'video' ? (
                  <>
                    {/* Video action buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (latestResult.jobId) {
                            window.location.assign(`/api/studio/download-video?jobId=${encodeURIComponent(latestResult.jobId)}`);
                          } else {
                            const a = document.createElement('a');
                            a.href = latestResult.url;
                            a.download = `studio-video-${Date.now()}.mp4`;
                            a.click();
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={() => {
                          const store = useStudioStore.getState();
                          store.initDefaultTracks();
                          const vt = useStudioStore.getState().timelineTracks.find(t => t.type === 'video');
                          if (vt) {
                            const sorted = [...vt.clips].sort((a, b) => a.startTime - b.startTime);
                            const last = sorted.at(-1);
                            const startTime = last ? last.startTime + last.duration : 0;
                            store.addClipToTrack(vt.id, {
                              type: 'video', startTime, duration: 5,
                              sourceUrl: latestResult.url, prompt: latestResult.prompt,
                            });
                          }
                          router.push('/studio/assemble');
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
                        </svg>
                        Add to Assemble
                      </button>
                    </div>

                    {/* Iteration buttons */}
                    <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                      <button
                        onClick={() => { setLatestResult(null); setPrompt(''); setCreateView('form'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create another
                      </button>
                      <button
                        onClick={() => { setLatestResult(null); setCreateView('form'); setShowGenerateVideo(true); }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        Create variation
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Image primary actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openResultInEditor('improve')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                        </svg>
                        Improve
                      </button>
                      <button
                        onClick={() => openResultInEditor('animate')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Animate
                      </button>
                    </div>

                    {/* Image secondary row */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = latestResult.url;
                          a.download = `studio-image-${Date.now()}.${outputFormat}`;
                          a.click();
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={() => openResultInEditor('upscale')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 3l6 0 0 6M9 21l-6 0 0-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                        Upscale
                      </button>
                      <button
                        onClick={() => openResultInEditor('remove-bg')}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 6a3 3 0 100-6 3 3 0 000 6zM6 18a3 3 0 100-6 3 3 0 000 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
                        </svg>
                        No BG
                      </button>
                    </div>

                    {/* Image iteration buttons */}
                    <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                      <button
                        onClick={() => { setLatestResult(null); setPrompt(''); setCreateView('form'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create another
                      </button>
                      <button
                        onClick={() => { setLatestResult(null); setCreateView('form'); }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        Edit prompt
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Card B: Edit a photo */}
          <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 flex flex-col gap-4 ${
            mobileTab === 'create' ? 'hidden md:flex' : 'flex'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Edit a photo
              </h2>
              <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                7 AI Tools
              </span>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleHeroDrop}
              onClick={() => heroUploadRef.current?.click()}
              className={`flex-1 min-h-[200px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver
                  ? 'border-green-500/60 bg-green-500/5'
                  : 'border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03]'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                dragOver ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-gray-400'
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300">
                  Drop a photo or <span className="text-green-400 underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Improve, remove background, upscale, animate, edit, or place products
                </p>
              </div>
            </div>

            <input
              ref={heroUploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroUpload}
            />
          </div>
        </div>

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {QUICK_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleQuickToolClick(tool.id)}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all group ${
                  tool.noImage
                    ? 'border-purple-500/20 bg-purple-500/[0.03] hover:bg-purple-500/[0.07] hover:border-purple-500/40'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-green-500/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  tool.noImage
                    ? 'bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-400 group-hover:text-purple-300'
                    : 'bg-white/5 group-hover:bg-green-500/10 text-gray-400 group-hover:text-green-400'
                }`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={tool.iconSvg} />
                  </svg>
                </div>
                <span className="text-xs font-medium text-white mb-0.5">{tool.label}</span>
                <span className="text-[10px] text-gray-500 leading-relaxed mb-2 line-clamp-2">{tool.description}</span>
                <span className={`mt-auto text-[10px] font-medium px-2 py-0.5 rounded w-fit ${
                  tool.noImage
                    ? 'text-purple-400 bg-purple-500/10 border border-purple-500/20'
                    : 'text-green-400 bg-green-500/10 border border-green-500/20'
                }`}>
                  {tool.credits}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Continue Working ────────────────────────────────────────────── */}
        {recentImages.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Continue Working
              </h3>
              <button
                onClick={() => router.push('/studio/library')}
                className="text-xs text-green-400 hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {recentImages.map(img => {
                const isVideo = img.type === 'video';
                return (
                  <div
                    key={img.id}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] cursor-pointer"
                    onClick={() => isVideo ? setModalVideo(img) : setModalImage(img)}
                  >
                    {isVideo ? (
                      <video
                        src={img.url}
                        className="aspect-square w-full object-cover"
                        muted loop playsInline
                        preload="metadata"
                        onError={e => { (e.target as HTMLVideoElement).closest('.group')?.classList.add('hidden'); }}
                        onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex flex-wrap gap-1 p-2">
                        {!isVideo && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); openEditorFromResult(img, 'improve'); }}
                              className="rounded px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white hover:bg-white/20"
                            >
                              Improve
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openEditorFromResult(img, 'animate'); }}
                              className="rounded px-2 py-0.5 text-[10px] font-medium bg-green-600/80 text-white hover:bg-green-600"
                            >
                              Animate
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openEditorFromResult(img, 'upscale'); }}
                              className="rounded px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white hover:bg-white/20"
                            >
                              Upscale
                            </button>
                          </>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleDownload(img); }}
                          className="rounded px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white hover:bg-white/20"
                        >
                          Download
                        </button>
                      </div>
                    </div>

                    {/* Type badge */}
                    {isVideo && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-purple-600/80 px-2 py-0.5 text-[10px] text-white">
                        Video
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODALS & EDITORS                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Hidden file input for Quick Tools */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Credit / pricing modals */}
      <CreditPackModal
        isOpen={showCreditPack}
        onClose={() => setShowCreditPack(false)}
        reason={creditPackReason}
        onShowPlans={() => setShowPricing(true)}
      />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={creditStatus?.plan}
        onBuyCredits={() => { setShowPricing(false); setCreditPackReason('credits'); setShowCreditPack(true); }}
      />

      {/* Checkout success toast */}
      {checkoutSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-xl">
          <span>✓</span>
          <span>
            {checkoutSuccess.startsWith('subscription:')
              ? 'Subscription activated!'
              : 'Credits added!'}
          </span>
          <button onClick={() => setCheckoutSuccess(null)} className="ml-2 text-white/70 hover:text-white">×</button>
        </div>
      )}

      {/* Image / Video detail modals */}
      {modalImage && (
        <ImageDetailModal
          img={modalImage}
          onClose={() => setModalImage(null)}
          onAnimate={() => {
            setModalImage(null);
            openEditorFromResult(modalImage, 'animate');
          }}
          onAddToAssemble={() => {}}
          onDownload={() => handleDownload(modalImage)}
          onCopy={() => {
            if (modalImage.prompt) navigator.clipboard.writeText(modalImage.prompt).catch(() => {});
          }}
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
            showSaved();
            setModalImage(null);
          }}
          galleryImages={generatedImages.filter(i => i.type === 'image').map(i => i.url)}
        />
      )}

      {modalVideo && (
        <VideoDetailModal
          videoUrl={modalVideo.url}
          prompt={modalVideo.prompt}
          aspectRatio={SIZE_PRESETS.find(s => s.id === modalVideo.preset)?.aspect_ratio}
          onClose={() => {
            const wasT2V = modalVideo.prompt?.startsWith('[T2V]');
            setModalVideo(null);
            if (wasT2V) setShowGenerateVideo(true);
          }}
          onRegenerate={() => {
            setModalVideo(null);
            if (modalVideo.prompt?.startsWith('[T2V]')) {
              setShowGenerateVideo(true);
            } else {
              const sourceImg = generatedImages.find(i => i.type === 'image');
              if (sourceImg) openEditorFromResult(sourceImg, 'animate');
            }
          }}
          onDownload={() => handleDownload(modalVideo)}
          onAddToAssemble={() => {}}
        />
      )}

      {/* ── Full-screen editors ────────────────────────────────────────────── */}

      {activeEditor?.tool === 'improve' && (
        <ImproveEditor
          imageUrl={activeEditor.imageUrl}
          imageFile={activeEditor.imageFile}
          onAccept={(resultUrl) => {
            setActiveEditor(null);
            handleEditorResult(resultUrl, '[Enhanced] Improve', 'grok-edit');
          }}
          onClose={() => setActiveEditor(null)}
        />
      )}

      {activeEditor?.tool === 'inpaint' && (
        <InpaintEditor
          imageUrl={activeEditor.imageUrl}
          onClose={() => setActiveEditor(null)}
          onResult={(url) => {
            setActiveEditor(null);
            handleEditorResult(url, '[Inpainted]', 'flux-fill-pro');
          }}
        />
      )}

      {activeEditor?.tool === 'remove-bg' && (
        <RemoveBgEditor
          imageUrl={activeEditor.imageUrl}
          imageFile={activeEditor.imageFile}
          onAccept={(resultUrl) => {
            setActiveEditor(null);
            handleEditorResult(resultUrl, '[No Background]', 'remove-bg');
          }}
          onClose={() => setActiveEditor(null)}
        />
      )}

      {activeEditor?.tool === 'upscale' && (
        <UpscaleEditor
          imageUrl={activeEditor.imageUrl}
          imageFile={activeEditor.imageFile}
          onAccept={(resultUrl) => {
            setActiveEditor(null);
            handleEditorResult(resultUrl, '[Upscaled]', 'upscale');
          }}
          onClose={() => setActiveEditor(null)}
        />
      )}

      {activeEditor?.tool === 'animate' && (
        <AnimateEditor
          imageUrl={activeEditor.imageUrl}
          selectedSize={selectedSize}
          hasVideoCredits={
            creditStatus
              ? (creditStatus.monthly.videos.remaining + creditStatus.bonus.videos) > 0 ||
                !!creditStatus.superuser || !!creditStatus.byok
              : false
          }
          onNeedCredits={() => {
            setCreditPackReason('video');
            setShowCreditPack(true);
          }}
          onAccept={(resultVideoUrl, videoPrompt) => {
            setActiveEditor(null);
            const newVideo: MediaItem = {
              id: `vid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'video',
              url: resultVideoUrl,
              prompt: videoPrompt,
              preset: selectedSize,
              createdAt: Date.now(),
            };
            addImage(newVideo);
            showSaved();
            setLatestResult({
              url: resultVideoUrl, prompt: videoPrompt,
              model: '', provider: '', tier: 'Video', credits: 0,
              type: 'video',
            });
            setCreateView('result');
            (window as unknown as Record<string, () => void>).__refreshCredits?.();
          }}
          onClose={() => setActiveEditor(null)}
        />
      )}

      {showPlaceProducts && placeProductsBgUrl && (
        <PlaceProductsEditor
          backgroundUrl={placeProductsBgUrl}
          initialCutouts={[]}
          galleryImages={generatedImages.filter(i => i.type === 'image').map(i => i.url)}
          onClose={() => { setShowPlaceProducts(false); setPlaceProductsBgUrl(null); }}
          onResult={(url) => {
            setShowPlaceProducts(false);
            setPlaceProductsBgUrl(null);
            handleEditorResult(url, '[Composite] Place Products', 'place-products');
          }}
        />
      )}

      {showGenerateVideo && (
        <GenerateVideoEditor
          hasVideoCredits={
            creditStatus
              ? (creditStatus.monthly.videos.remaining + creditStatus.bonus.videos) > 0 ||
                !!creditStatus.superuser || !!creditStatus.byok
              : false
          }
          onNeedCredits={() => {
            setShowGenerateVideo(false);
            setCreditPackReason('video');
            setShowCreditPack(true);
          }}
          onAccept={(videoUrl, videoPrompt, jobId) => {
            setShowGenerateVideo(false);
            const newVideo: MediaItem = {
              id:        `vid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type:      'video',
              url:       videoUrl,
              prompt:    `[T2V] ${videoPrompt.slice(0, 100)}`,
              jobId,
              createdAt: Date.now(),
            };
            addImage(newVideo);
            showSaved();
            setLatestResult({
              url: videoUrl, prompt: videoPrompt,
              model: '', provider: '', tier: 'Video', credits: 0,
              type: 'video', jobId,
            });
            setCreateView('result');
            (window as unknown as Record<string, () => void>).__refreshCredits?.();
          }}
          onClose={() => setShowGenerateVideo(false)}
        />
      )}

      {showSavedToast && (
        <div className="animate-toast-in fixed bottom-6 left-1/2 z-50 flex items-center gap-2 rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
          <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Saved to My Work
        </div>
      )}
    </div>
  );
}
