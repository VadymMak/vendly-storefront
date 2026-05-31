'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { VideoSkill, ApiKeyInfo } from '@/lib/types';
import CreditCounter from '@/components/studio/CreditCounter';
import UpgradeModal from '@/components/studio/UpgradeModal';
import { replicateDirectRun, fetchImageAsBlob } from '@/lib/replicate-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_SKILLS: VideoSkill[] = [
  { id: 'ig-reel',   label: 'Instagram Reel',   aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a creative director for Instagram Reels. Transform the user input into a cinematic, visually engaging video prompt optimized for vertical 9:16 format. Focus on dynamic motion, vibrant colors, trend-forward aesthetics, and hook within the first second. Output ONLY the enhanced prompt, no explanations.' },
  { id: 'ig-story',  label: 'Instagram Story',  aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a social media content director specializing in Instagram Stories. Transform the user input into a visually compelling 9:16 video prompt with a clear narrative arc fitting 5 seconds. Output ONLY the enhanced prompt.' },
  { id: 'ig-post',   label: 'Instagram Post',   aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are a visual content creator for Instagram feed posts. Transform the user input into a square 1:1 video prompt with polished, editorial aesthetics. Output ONLY the enhanced prompt.' },
  { id: 'yt-shorts', label: 'YouTube Shorts',   aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a YouTube Shorts content strategist. Transform the user input into an engaging 9:16 vertical video prompt for 10 seconds. Output ONLY the enhanced prompt.' },
  { id: 'tiktok',    label: 'TikTok',           aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a TikTok creative director. Transform the user input into a viral-optimized 9:16 video prompt with a surprising element. Output ONLY the enhanced prompt.' },
  { id: 'cinematic', label: 'Cinematic',        aspectRatio: '16:9', duration: 10, systemPrompt: 'You are a cinematic director of photography. Transform the user input into a high-end cinematic video prompt in 16:9 widescreen. Describe lighting, camera movement, depth of field, and mood. Output ONLY the enhanced prompt.' },
  { id: 'product',   label: 'Product Showcase', aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are an e-commerce video director. Transform the user input into a clean product showcase video prompt in 1:1. Focus on 360° reveal, material texture, subtle motion. Output ONLY the enhanced prompt.' },
];

const PRESET_MAP = {
  og:      { label: 'OG Image',     display: '1200 × 630',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1200, target_height: 630  },
  cover:   { label: 'Cover / Hero', display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  product: { label: 'Product',      display: '800 × 800',   aspect_ratio: '1:1',  megapixels: '1',    target_width: 800,  target_height: 800  },
  story:   { label: 'Story / Reel', display: '630 × 1120',  aspect_ratio: '9:16', megapixels: '1',    target_width: 630,  target_height: 1120 },
  blog:    { label: 'Blog Header',  display: '1440 × 810',  aspect_ratio: '16:9', megapixels: '1',    target_width: 1440, target_height: 810  },
  thumb:   { label: 'Thumbnail',    display: '400 × 300',   aspect_ratio: '4:3',  megapixels: '0.25', target_width: 400,  target_height: 300  },
} as const;

const STYLE_TAGS = [
  'photorealistic', 'cinematic', 'studio lighting', 'soft natural light',
  'golden hour', 'minimalist', 'dark moody', 'flat lay', 'bokeh background',
  '8K ultra detail', 'commercial', 'editorial',
];

const ENHANCE_MODES = [
  { value: 'og',       label: '📣 OG / Social banner' },
  { value: 'hero',     label: '🎯 Hero / Landing page' },
  { value: 'product',  label: '🛍 E-commerce product photo' },
  { value: 'interior', label: '🏠 Interior / Place atmosphere' },
  { value: 'food',     label: '🍽 Food / Menu photography' },
  { value: 'abstract', label: '✨ Abstract / Decorative' },
];

const OUTPUT_FORMATS = ['webp', 'png', 'jpeg'] as const;

const QUICK_FILTERS = [
  { id: 'original', label: 'Original', filter: 'none' },
  { id: 'vivid',    label: 'Vivid',    filter: 'saturate(1.4) contrast(1.1)' },
  { id: 'warm',     label: 'Warm',     filter: 'sepia(0.2) saturate(1.2) brightness(1.05)' },
  { id: 'cool',     label: 'Cool',     filter: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)' },
  { id: 'bw',       label: 'B&W',      filter: 'grayscale(1)' },
  { id: 'sepia',    label: 'Sepia',    filter: 'sepia(0.8)' },
  { id: 'vintage',  label: 'Vintage',  filter: 'sepia(0.3) contrast(0.9) brightness(0.95) saturate(0.8)' },
  { id: 'dramatic', label: 'Dramatic', filter: 'contrast(1.4) brightness(0.9) saturate(1.2)' },
  { id: 'soft',     label: 'Soft',     filter: 'brightness(1.1) contrast(0.9) blur(0.5px)' },
  { id: 'fade',     label: 'Fade',     filter: 'brightness(1.1) saturate(0.7) contrast(0.9)' },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ByokConfig {
  byok: boolean;
  superuser?: boolean;
  apiKey?: string;
  models?: {
    image:      string;
    startFrame: string;
    video:      string;
    upscale:    string;
    removeBg:   string;
    aiEdit:     string;
  };
}

type StudioTab      = 'image' | 'video';
type ImageSubTab    = 'generate' | 'edit';
type VideoMode      = 'text' | 'image';
type GenStep        = 'generating-frame' | 'rate-limiting' | 'animating' | null;
type AiEditTool     = 'upscale' | 'face' | 'removebg' | 'aiedit' | null;
type Provider       = 'replicate' | 'anthropic';
type HelpSection    = 'replicate' | 'anthropic' | 'tips';
type PresetKey      = keyof typeof PRESET_MAP;
type OutputFormat   = typeof OUTPUT_FORMATS[number];

interface ImageMeta { display: string; ratio: string; fmt: OutputFormat; label: string; }
interface Props { userId: string; userEmail: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function aspectToPreviewDims(ratio: string, maxW = 44, maxH = 30) {
  const [a, b] = ratio.split(':').map(Number);
  const r = a / b;
  if (r > maxW / maxH) return { width: maxW, height: Math.round(maxW / r) };
  return { width: Math.round(maxH * r), height: maxH };
}

function buildEditFilter(filterId: string, brightness: number, contrast: number, saturation: number, temperature: number): string {
  const base = QUICK_FILTERS.find((f) => f.id === filterId)?.filter ?? 'none';
  const adj: string[] = [];
  if (brightness !== 100) adj.push(`brightness(${brightness / 100})`);
  if (contrast   !== 100) adj.push(`contrast(${contrast / 100})`);
  if (saturation !== 100) adj.push(`saturate(${saturation / 100})`);
  if (temperature !== 0) {
    if (temperature > 0) {
      adj.push(`sepia(${(temperature / 50) * 0.25})`);
      adj.push(`hue-rotate(${-temperature * 0.3}deg)`);
    } else {
      adj.push(`hue-rotate(${Math.abs(temperature) * 0.4}deg)`);
    }
  }
  const parts = [...(base !== 'none' ? [base] : []), ...adj];
  return parts.length > 0 ? parts.join(' ') : 'none';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioClient({ userId: _userId, userEmail }: Props) {
  const searchParams = useSearchParams();
  const [studioTab, setStudioTab] = useState<StudioTab>(() =>
    searchParams.get('tab') === 'video' ? 'video' : 'image',
  );

  // ── Shared: API Keys ──────────────────────────────────────────────────────
  const [keys,        setKeys]        = useState<ApiKeyInfo[]>([]);
  const [keysLoaded,  setKeysLoaded]  = useState(false);
  const [keyInputs,   setKeyInputs]   = useState<Record<Provider, string>>({ replicate: '', anthropic: '' });
  const [keySaving,   setKeySaving]   = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });
  const [keyDeleting, setKeyDeleting] = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });

  // ── Shared: Wizard ────────────────────────────────────────────────────────
  const [wizardStep,   setWizardStep]   = useState<1 | 2 | null>(null);
  const [wizardInputs, setWizardInputs] = useState<Record<Provider, string>>({ replicate: '', anthropic: '' });
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError,  setWizardError]  = useState<string | null>(null);

  // ── Shared: Help drawer ───────────────────────────────────────────────────
  const [helpOpen,    setHelpOpen]    = useState(false);
  const [helpSection, setHelpSection] = useState<HelpSection>('replicate');
  const helpRefs = useRef<Partial<Record<HelpSection, HTMLElement | null>>>({});

  // ── Image tab ─────────────────────────────────────────────────────────────
  const [imageSubTab,       setImageSubTab]       = useState<ImageSubTab>('generate');
  const [imgPrompt,         setImgPrompt]         = useState('');
  const [imgEnhancedPrompt, setImgEnhancedPrompt] = useState<string | null>(null);
  const [imgSelectedPreset, setImgSelectedPreset] = useState<PresetKey>('og');
  const [imgOutputFormat,   setImgOutputFormat]   = useState<OutputFormat>('webp');
  const [imgActiveTags,     setImgActiveTags]     = useState<Set<string>>(new Set());
  const [imgEnhanceMode,    setImgEnhanceMode]    = useState('og');
  const [imgEnhancing,      setImgEnhancing]      = useState(false);
  const [imgGenerating,     setImgGenerating]     = useState(false);
  const [imgUrl,            setImgUrl]            = useState<string | null>(null);
  const [imgMeta,           setImgMeta]           = useState<ImageMeta | null>(null);
  const [imgError,          setImgError]          = useState<string | null>(null);
  const [imgAnimating,      setImgAnimating]      = useState(false);
  // Edit photo sub-tab
  const [editFile,        setEditFile]        = useState<File | null>(null);
  const [editPreview,     setEditPreview]     = useState<string | null>(null);
  const [editFilter,      setEditFilter]      = useState('original');
  const [editAdjustOpen,  setEditAdjustOpen]  = useState(false);
  const [editBrightness,  setEditBrightness]  = useState(100);
  const [editContrast,    setEditContrast]    = useState(100);
  const [editSaturation,  setEditSaturation]  = useState(100);
  const [editTemperature, setEditTemperature] = useState(0);
  const [editSharpness,   setEditSharpness]   = useState(0);
  const [editAiTool,       setEditAiTool]       = useState<AiEditTool>(null);
  const [editAiResult,     setEditAiResult]     = useState<string | null>(null);
  const [editAiError,      setEditAiError]      = useState<string | null>(null);
  const [editSaving,       setEditSaving]       = useState(false);
  const [editAnimating,    setEditAnimating]    = useState(false);
  const [editSaveFormat,   setEditSaveFormat]   = useState<'png' | 'jpeg' | 'webp'>('webp');
  const [editIsTransparent,setEditIsTransparent]= useState(false);
  const [editAiEditOpen,      setEditAiEditOpen]      = useState(false);
  const [editAiEditPrompt,    setEditAiEditPrompt]    = useState('');
  const [editAiEditEnhancing, setEditAiEditEnhancing] = useState(false);
  const [editAiEditResult,    setEditAiEditResult]    = useState<string | null>(null);
  const [editRotation,        setEditRotation]        = useState(0);
  const [editFlipH,           setEditFlipH]           = useState(false);
  const [editFlipV,           setEditFlipV]           = useState(false);

  // ── Video tab ─────────────────────────────────────────────────────────────
  const [videoMode,        setVideoMode]        = useState<VideoMode>('text');
  const [selectedSkill,    setSelectedSkill]    = useState<VideoSkill>(VIDEO_SKILLS[0]);
  const [vidPrompt,        setVidPrompt]        = useState('');
  const [vidEnhancing,     setVidEnhancing]     = useState(false);
  const [vidUploadedUrl,   setVidUploadedUrl]   = useState<string | null>(null);
  const [vidUploading,     setVidUploading]     = useState(false);
  const [vidDragOver,      setVidDragOver]      = useState(false);
  const vidFileInputRef = useRef<HTMLInputElement>(null);
  const [genStep,          setGenStep]          = useState<GenStep>(null);
  const [vidStartImageUrl, setVidStartImageUrl] = useState<string | null>(null);
  const [vidUrl,           setVidUrl]           = useState<string | null>(null);
  const [vidError,         setVidError]         = useState<string | null>(null);

  // ── BYOK direct-call config ───────────────────────────────────────────────
  const [byokConfig, setByokConfig] = useState<ByokConfig | null>(null);

  // ── Upgrade modal ─────────────────────────────────────────────────────────
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [upgradeType,  setUpgradeType]  = useState<'image' | 'video' | 'general'>('general');

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [keysRes, byokRes] = await Promise.all([
        fetch('/api/user/api-keys'),
        fetch('/api/studio/byok-config'),
      ]);
      if (keysRes.ok) {
        const data: ApiKeyInfo[] = await keysRes.json();
        setKeys(data);
      }
      if (byokRes.ok) {
        setByokConfig(await byokRes.json() as ByokConfig);
      } else {
        setByokConfig({ byok: false });
      }
      setKeysLoaded(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const el = helpRefs.current[helpSection];
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [helpOpen, helpSection]);

  useEffect(() => {
    const handler = () => { setUpgradeType('general'); setShowUpgrade(true); };
    window.addEventListener('studio:showUpgrade', handler);
    return () => window.removeEventListener('studio:showUpgrade', handler);
  }, []);

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/user/api-keys');
    if (res.ok) setKeys(await res.json());
  }, []);

  const keyFor = (p: Provider) => keys.find((k) => k.provider === p);
  const isGenerating = genStep !== null;

  // ── Key management ────────────────────────────────────────────────────────
  async function saveKey(provider: Provider) {
    const key = keyInputs[provider].trim();
    if (!key) return;
    setKeySaving((s) => ({ ...s, [provider]: true }));
    try {
      const res = await fetch('/api/user/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) });
      if (!res.ok) throw new Error(await res.text());
      setKeyInputs((s) => ({ ...s, [provider]: '' }));
      await loadKeys();
    } catch { /* surfaced via wizard */ }
    finally { setKeySaving((s) => ({ ...s, [provider]: false })); }
  }

  async function deleteKey(provider: Provider) {
    const k = keyFor(provider);
    if (!k) return;
    setKeyDeleting((s) => ({ ...s, [provider]: true }));
    try { await fetch(`/api/user/api-keys/${k.id}`, { method: 'DELETE' }); await loadKeys(); }
    finally { setKeyDeleting((s) => ({ ...s, [provider]: false })); }
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  async function wizardSave(provider: Provider): Promise<boolean> {
    const key = wizardInputs[provider].trim();
    if (!key) return false;
    setWizardSaving(true);
    setWizardError(null);
    try {
      const res = await fetch('/api/user/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; throw new Error(d.error ?? 'Failed to save key'); }
      await loadKeys();
      return true;
    } catch (e) { setWizardError(e instanceof Error ? e.message : 'Failed to save key'); return false; }
    finally { setWizardSaving(false); }
  }

  async function wizardNext() { const ok = await wizardSave('replicate'); if (ok) setWizardStep(2); }
  async function wizardFinish(skip: boolean) {
    if (!skip && wizardInputs.anthropic.trim()) { const ok = await wizardSave('anthropic'); if (!ok) return; }
    setWizardStep(null);
  }

  function openHelp(section: HelpSection) { setHelpSection(section); setHelpOpen(true); }

  // ── Image tab: generate ───────────────────────────────────────────────────
  function imgSelectPreset(key: PresetKey) { setImgSelectedPreset(key); setImgEnhancedPrompt(null); }
  function imgToggleTag(tag: string) {
    setImgActiveTags((prev) => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; });
  }

  async function imgHandleEnhance() {
    if (!imgPrompt.trim() || imgEnhancing) return;
    setImgEnhancing(true);
    setImgError(null);
    try {
      const res = await fetch('/api/enhance-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: imgPrompt, enhanceMode: imgEnhanceMode, styleTags: [...imgActiveTags] }) });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok || !data.enhanced) throw new Error(data.error ?? 'Enhancement failed');
      setImgEnhancedPrompt(data.enhanced);
    } catch (e) { setImgError(e instanceof Error ? e.message : 'Enhancement failed'); }
    finally { setImgEnhancing(false); }
  }

  async function imgHandleGenerate() {
    const finalPrompt = (imgEnhancedPrompt ?? imgPrompt).trim();
    if (!finalPrompt || imgGenerating) return;
    const preset = PRESET_MAP[imgSelectedPreset];
    setImgGenerating(true);
    setImgError(null);
    setImgUrl(null);
    setImgMeta(null);

    // ── BYOK direct path — browser polls Replicate, zero Vercel CPU ──────────
    if (byokConfig?.byok && byokConfig.apiKey && byokConfig.models) {
      try {
        const result = await replicateDirectRun(byokConfig.apiKey, {
          model: byokConfig.models.image,
          input: { prompt: finalPrompt, aspect_ratio: preset.aspect_ratio, megapixels: preset.megapixels, num_outputs: 1, output_format: 'webp', output_quality: 90, go_fast: true, num_inference_steps: 4 },
        });
        const blobUrl = await fetchImageAsBlob(result.output as string);
        setImgUrl(blobUrl);
        setImgMeta({ display: preset.display, ratio: preset.aspect_ratio, fmt: 'webp', label: preset.label });
        fetch('/api/studio/track-generation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'image' }) }).catch(() => {});
        (window as unknown as Record<string, () => void>).__refreshCredits?.();
      } catch (e) { setImgError(e instanceof Error ? e.message : 'Generation failed'); }
      finally { setImgGenerating(false); }
      return;
    }

    // ── Server-side path (credit users) ──────────────────────────────────────
    try {
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalPrompt, aspect_ratio: preset.aspect_ratio, megapixels: preset.megapixels, target_width: preset.target_width, target_height: preset.target_height, output_format: imgOutputFormat }) });
      if (!res.ok) { const e = await res.json() as { error?: string; needsUpgrade?: boolean }; if (e.needsUpgrade) { setUpgradeType('image'); setShowUpgrade(true); return; } throw new Error(e.error ?? 'Generation failed'); }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
      setImgMeta({ display: preset.display, ratio: preset.aspect_ratio, fmt: imgOutputFormat, label: preset.label });
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) { setImgError(e instanceof Error ? e.message : 'Generation failed'); }
    finally { setImgGenerating(false); }
  }

  async function imgHandleDownload(url: string, meta: ImageMeta) {
    try {
      const blob = await (await fetch(url)).blob();
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `flux-image-${Date.now()}.${meta.fmt}` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* silent */ }
  }

  async function imgLoadIntoEditor(url: string) {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `generated-${Date.now()}.webp`, { type: blob.type || 'image/webp' });
      setEditFile(file);
      setEditPreview(URL.createObjectURL(blob));
      setEditAiResult(null);
      setEditAiError(null);
      setEditFilter('original');
      setEditBrightness(100);
      setEditContrast(100);
      setEditSaturation(100);
      setEditTemperature(0);
      setEditSharpness(0);
      setEditAdjustOpen(false);
      setEditSaveFormat('webp');
      setEditIsTransparent(false);
      setEditRotation(0);
      setEditFlipH(false);
      setEditFlipV(false);
      setEditAiEditResult(null);
      setEditAiEditOpen(false);
      setImageSubTab('edit');
    } catch { /* silent */ }
  }

  // "Animate this →" — upload blob → switch to video Image→Video mode
  async function animateImage(sourceUrl: string) {
    setImgAnimating(true);
    setImgError(null);
    try {
      let publicUrl = sourceUrl;
      if (sourceUrl.startsWith('blob:')) {
        const blob = await (await fetch(sourceUrl)).blob();
        const file = new File([blob], `studio-image-${Date.now()}.webp`, { type: blob.type || 'image/webp' });
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        publicUrl = data.url!;
      }
      setVidUploadedUrl(publicUrl);
      setVideoMode('image');
      setStudioTab('video');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setImgError(e instanceof Error ? e.message : 'Failed to prepare image for animation'); }
    finally { setImgAnimating(false); }
  }

  // ── Image tab: edit photo ─────────────────────────────────────────────────
  function editHandleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setEditFile(file);
    setEditPreview(file ? URL.createObjectURL(file) : null);
    setEditAiResult(null);
    setEditAiError(null);
    setEditSaving(false);
    setEditFilter('original');
    setEditBrightness(100);
    setEditContrast(100);
    setEditSaturation(100);
    setEditTemperature(0);
    setEditSharpness(0);
    setEditAdjustOpen(false);
    setEditSaveFormat('webp');
    setEditIsTransparent(false);
    setEditRotation(0);
    setEditFlipH(false);
    setEditFlipV(false);
    setEditAiEditResult(null);
    setEditAiEditOpen(false);
  }

  function editResetAdjust() {
    setEditBrightness(100);
    setEditContrast(100);
    setEditSaturation(100);
    setEditTemperature(0);
    setEditSharpness(0);
  }

  async function editGetSourceFile(): Promise<File> {
    if (editAiResult) {
      const res = await fetch(editAiResult);
      const blob = await res.blob();
      return new File([blob], 'edited.png', { type: blob.type || 'image/png' });
    }
    if (!editFile) throw new Error('No image loaded');
    return editFile;
  }

  async function editRunAiTool(tool: 'upscale' | 'face' | 'removebg') {
    if (editAiTool) return;
    setEditAiTool(tool);
    setEditAiError(null);
    try {
      const sourceFile = await editGetSourceFile();

      // ── BYOK direct path — browser calls Replicate, zero Vercel CPU ──────────
      if (byokConfig?.byok && byokConfig.apiKey && byokConfig.models) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(sourceFile);
        });
        if (tool === 'removebg') {
          const result = await replicateDirectRun(byokConfig.apiKey, {
            model: byokConfig.models.removeBg,
            input: { image: dataUrl },
          });
          const resultUrl = typeof result.output === 'string' ? result.output : String(result.output);
          setEditAiResult(resultUrl);
          setEditIsTransparent(true);
          setEditSaveFormat('png');
        } else {
          const input = tool === 'upscale'
            ? { image: dataUrl, scale: 4, face_enhance: false }
            : { image: dataUrl, scale: 2, face_enhance: true };
          const result = await replicateDirectRun(byokConfig.apiKey, {
            model: byokConfig.models.upscale,
            input,
          });
          const resultUrl = typeof result.output === 'string' ? result.output : String(result.output);
          setEditAiResult(resultUrl);
          setEditIsTransparent(false);
        }
        fetch('/api/studio/track-generation', {
          method: 'POST',
          body: JSON.stringify({ type: 'image' }),
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
        return;
      }

      // ── Server path ───────────────────────────────────────────────────────────
      const fd = new FormData();
      fd.append('image', sourceFile);
      let url: string;
      if (tool === 'removebg') {
        const res = await fetch('/api/remove-bg', { method: 'POST', body: fd });
        const data = await res.json() as { url?: string; error?: string; needsUpgrade?: boolean };
        if (!res.ok) { if (data.needsUpgrade) { setUpgradeType('image'); setShowUpgrade(true); return; } throw new Error(data.error ?? 'Remove background failed'); }
        url = data.url!;
        setEditIsTransparent(true);
        setEditSaveFormat('png');
      } else {
        fd.append('type', tool === 'upscale' ? 'upscale' : 'portrait');
        const res = await fetch('/api/enhance-image', { method: 'POST', body: fd });
        const data = await res.json() as { url?: string; error?: string; needsUpgrade?: boolean };
        if (!res.ok) { if (data.needsUpgrade) { setUpgradeType('image'); setShowUpgrade(true); return; } throw new Error(data.error ?? 'AI enhancement failed'); }
        url = data.url!;
        setEditIsTransparent(false);
      }
      setEditAiResult(url);
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'AI tool failed'); }
    finally { setEditAiTool(null); }
  }

  async function editRunAiEdit() {
    if (editAiTool || !editAiEditPrompt.trim()) return;
    setEditAiTool('aiedit');
    setEditAiError(null);
    setEditAiEditResult(null);
    try {
      const sourceFile = await editGetSourceFile();
      const fd = new FormData();
      fd.append('image', sourceFile);
      fd.append('prompt', editAiEditPrompt.trim());
      const res = await fetch('/api/ai-edit', { method: 'POST', body: fd });
      if (!res.ok) {
        let errMsg = 'AI edit failed';
        try {
          const errData = await res.json() as { error?: string; needsUpgrade?: boolean };
          if (errData.needsUpgrade) { setUpgradeType('image'); setShowUpgrade(true); return; }
          errMsg = errData.error ?? errMsg;
        } catch {
          errMsg = await res.text().catch(() => errMsg);
        }
        throw new Error(errMsg);
      }
      const data = await res.json() as { url?: string };
      if (!data.url) throw new Error('AI edit returned no image URL');
      setEditAiEditResult(data.url);
      (window as unknown as Record<string, () => void>).__refreshCredits?.();
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'AI edit failed'); }
    finally { setEditAiTool(null); }
  }

  async function editImproveAiEditPrompt() {
    if (!editAiEditPrompt.trim() || editAiEditEnhancing) return;
    setEditAiEditEnhancing(true);
    setEditAiError(null);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editAiEditPrompt, skillId: 'aiedit' }),
      });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Enhancement failed');
      if (data.enhanced) setEditAiEditPrompt(data.enhanced);
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'Prompt improvement failed'); }
    finally { setEditAiEditEnhancing(false); }
  }

  async function editAiEditDownload() {
    if (!editAiEditResult || editSaving) return;
    setEditSaving(true);
    try {
      const imgRes = await fetch(editAiEditResult);
      const imgBlob = await imgRes.blob();
      const fd = new FormData();
      fd.append('image', imgBlob, 'ai-edit.png');
      fd.append('format', editSaveFormat);
      const resp = await fetch('/api/export-image', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error('Export failed');
      const outBlob = await resp.blob();
      const url = URL.createObjectURL(outBlob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `ai-edit-${Date.now()}.${editSaveFormat}` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'Download failed'); }
    finally { setEditSaving(false); }
  }

  async function editRenderCanvas(source: string): Promise<Blob> {
    const img = new Image();
    const isExternal = source.startsWith('http');
    if (isExternal) img.crossOrigin = 'anonymous';
    const imgSrc = isExternal
      ? `${source}${source.includes('?') ? '&' : '?'}cb=${Date.now()}`
      : source;
    await new Promise<void>((res, rej) => {
      const timeout = setTimeout(() => rej(new Error('Image load timeout')), 30_000);
      img.onload  = () => { clearTimeout(timeout); res(); };
      img.onerror = () => { clearTimeout(timeout); rej(new Error('Image load failed')); };
      img.src = imgSrc;
    });
    const rad = editRotation * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
    canvas.height = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);
    const ctx = canvas.getContext('2d')!;
    const f = buildEditFilter(editFilter, editBrightness, editContrast, editSaturation, editTemperature);
    if (f !== 'none') ctx.filter = f;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.scale(editFlipH ? -1 : 1, editFlipV ? -1 : 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
    return new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas.toBlob failed'))), 'image/png')
    );
  }

  async function editSaveAndDownload() {
    const source = editAiResult ?? editPreview;
    if (!source || editSaving) return;
    setEditSaving(true);
    setEditAiError(null);
    try {
      const blob = await editRenderCanvas(source);
      const fd = new FormData();
      fd.append('image', blob, 'edited.png');
      fd.append('format', editSaveFormat);
      const resp = await fetch('/api/export-image', { method: 'POST', body: fd });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({ error: 'Export failed' })) as { error?: string };
        throw new Error(d.error ?? 'Export failed');
      }
      const outBlob = await resp.blob();
      const url = URL.createObjectURL(outBlob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `edited-${Date.now()}.${editSaveFormat}` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'Export failed'); }
    finally { setEditSaving(false); }
  }

  async function editAnimate() {
    const source = editAiResult ?? editPreview;
    if (!source || editAnimating) return;
    setEditAnimating(true);
    setEditAiError(null);
    try {
      const blob = await editRenderCanvas(source);
      const file = new File([blob], `edit-${Date.now()}.png`, { type: 'image/png' });
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setVidUploadedUrl(data.url!);
      setVideoMode('image');
      setStudioTab('video');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setEditAiError(e instanceof Error ? e.message : 'Failed to prepare for animation'); }
    finally { setEditAnimating(false); }
  }


  // ── Video tab ─────────────────────────────────────────────────────────────
  async function vidUploadFile(file: File) {
    if (!file.type.startsWith('image/')) { setVidError('Only image files are supported'); return; }
    setVidUploading(true);
    setVidError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setVidUploadedUrl(data.url ?? null);
    } catch (e) { setVidError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setVidUploading(false); }
  }

  function vidHandleDrop(e: React.DragEvent) {
    e.preventDefault();
    setVidDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) vidUploadFile(file);
  }

  async function vidHandleEnhance() {
    if (!vidPrompt.trim()) return;
    setVidEnhancing(true);
    setVidError(null);
    try {
      const res = await fetch('/api/enhance-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id }) });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to enhance');
      setVidPrompt(data.enhanced ?? vidPrompt);
    } catch (e) { setVidError(e instanceof Error ? e.message : 'Enhance failed'); }
    finally { setVidEnhancing(false); }
  }

  async function pollJobUntilDone(jobId: string): Promise<{ status: string; outputUrl?: string; error?: string }> {
    const maxPollTime = 10 * 60 * 1000;
    const startTime = Date.now();
    while (true) {
      if (Date.now() - startTime > maxPollTime) {
        return { status: 'failed', error: 'Generation timed out' };
      }
      await new Promise<void>((r) => setTimeout(r, 4000));
      try {
        const res = await fetch(`/api/studio/job/${jobId}`);
        if (!res.ok) continue;
        const data = await res.json() as { status: string; outputUrl?: string; error?: string };
        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') return data;
      } catch { /* Network error — retry */ }
    }
  }

  async function vidHandleGenerate() {
    if (!vidPrompt.trim()) return;
    setVidError(null);
    setVidUrl(null);
    setVidStartImageUrl(null);

    // ── BYOK path — start frame direct (Flux/CORS ok), video via server async ──
    // Kling v2.1 does not send CORS headers → direct browser fetch is blocked.
    // Server creates the prediction with the user's own key and returns jobId <1s.
    if (byokConfig?.byok && byokConfig.apiKey && byokConfig.models) {
      try {
        if (videoMode === 'text') {
          setGenStep('generating-frame');
          const frameResult = await replicateDirectRun(byokConfig.apiKey, {
            model: byokConfig.models.startFrame,
            input: { prompt: vidPrompt, go_fast: true, num_outputs: 1, aspect_ratio: selectedSkill.aspectRatio, output_format: 'webp', output_quality: 90, num_inference_steps: 4 },
          });
          const frameUrl = frameResult.output as string;
          setVidStartImageUrl(frameUrl);

          setGenStep('animating');
          const videoRes = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: frameUrl }),
          });
          const videoData = await videoRes.json() as { jobId?: string; url?: string; error?: string; needsUpgrade?: boolean };
          if (!videoRes.ok) { setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }
          if (videoData.jobId) {
            const result = await pollJobUntilDone(videoData.jobId);
            if (result.status === 'succeeded' && result.outputUrl) { setVidUrl(result.outputUrl); }
            else { setVidError(result.error ?? 'Video generation failed'); }
          } else if (videoData.url) { setVidUrl(videoData.url); }
        } else {
          if (!vidUploadedUrl) { setVidError('Please upload an image first'); return; }
          setGenStep('animating');
          const videoRes = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: vidUploadedUrl }),
          });
          const videoData = await videoRes.json() as { jobId?: string; url?: string; error?: string; needsUpgrade?: boolean };
          if (!videoRes.ok) { setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }
          if (videoData.jobId) {
            const result = await pollJobUntilDone(videoData.jobId);
            if (result.status === 'succeeded' && result.outputUrl) { setVidUrl(result.outputUrl); }
            else { setVidError(result.error ?? 'Video generation failed'); }
          } else if (videoData.url) { setVidUrl(videoData.url); }
        }
        fetch('/api/studio/track-generation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'video' }) }).catch(() => {});
        (window as unknown as Record<string, () => void>).__refreshCredits?.();
      } catch (e) { setVidError(e instanceof Error ? e.message : 'Video generation failed'); }
      finally { setGenStep(null); }
      return;
    }

    // ── Server-side path (credit users) ──────────────────────────────────────
    if (videoMode === 'text') {
      setGenStep('generating-frame');
      const frameRes = await fetch('/api/generate-start-frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, aspectRatio: selectedSkill.aspectRatio }) });
      const frameData = await frameRes.json() as { url?: string; jobId?: string; async?: boolean; error?: string };
      if (!frameRes.ok) { setVidError(frameData.error ?? 'Frame generation failed'); setGenStep(null); return; }

      let startImageUrl: string;
      if (frameData.url) {
        startImageUrl = frameData.url;
      } else if (frameData.jobId && frameData.async) {
        const frameJob = await pollJobUntilDone(frameData.jobId);
        if (frameJob.status !== 'succeeded' || !frameJob.outputUrl) { setVidError(frameJob.error ?? 'Frame generation failed'); setGenStep(null); return; }
        startImageUrl = frameJob.outputUrl;
      } else {
        setVidError('Frame generation failed'); setGenStep(null); return;
      }
      setVidStartImageUrl(startImageUrl);

      setGenStep('animating');
      const videoRes = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: startImageUrl }) });
      const videoData = await videoRes.json() as { jobId?: string; url?: string; error?: string; needsUpgrade?: boolean };
      if (!videoRes.ok) { if (videoData.needsUpgrade) { setUpgradeType('video'); setShowUpgrade(true); setGenStep(null); return; } setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }

      if (videoData.jobId) {
        const result = await pollJobUntilDone(videoData.jobId);
        if (result.status === 'succeeded' && result.outputUrl) {
          setVidUrl(result.outputUrl);
          (window as unknown as Record<string, () => void>).__refreshCredits?.();
        } else { setVidError(result.error ?? 'Video generation failed'); }
      } else if (videoData.url) {
        setVidUrl(videoData.url);
        (window as unknown as Record<string, () => void>).__refreshCredits?.();
      }
    } else {
      if (!vidUploadedUrl) { setVidError('Please upload an image first'); return; }
      setGenStep('animating');
      const videoRes = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: vidUploadedUrl }) });
      const videoData = await videoRes.json() as { jobId?: string; url?: string; error?: string; needsUpgrade?: boolean };
      if (!videoRes.ok) { if (videoData.needsUpgrade) { setUpgradeType('video'); setShowUpgrade(true); setGenStep(null); return; } setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }

      if (videoData.jobId) {
        const result = await pollJobUntilDone(videoData.jobId);
        if (result.status === 'succeeded' && result.outputUrl) {
          setVidUrl(result.outputUrl);
          (window as unknown as Record<string, () => void>).__refreshCredits?.();
        } else { setVidError(result.error ?? 'Video generation failed'); }
      } else if (videoData.url) {
        setVidUrl(videoData.url);
        (window as unknown as Record<string, () => void>).__refreshCredits?.();
      }
    }
    setGenStep(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!keysLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const imgPreset = PRESET_MAP[imgSelectedPreset];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ══ ONBOARDING WIZARD ══════════════════════════════════════════════ */}
      {wizardStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-2xl">
            <div className="mb-7 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-[var(--color-primary)]" />
              <div className={cx('h-1.5 flex-1 rounded-full transition-colors', wizardStep === 2 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]')} />
              <span className="ml-2 shrink-0 text-xs text-[var(--color-text-dim)]">Step {wizardStep} of 2</span>
            </div>

            {wizardStep === 1 && (
              <>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </div>
                <h2 className="text-xl font-bold">Get your Replicate API key</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Replicate runs the AI models for video generation. You need an API key and at least $5 credit to use Video Generator.</p>
                <ol className="mt-5 space-y-2.5 text-sm text-[var(--color-text-muted)]">
                  {(['Go to replicate.com → Sign up (GitHub login works)', 'replicate.com/account/api-tokens → Create token', 'replicate.com/account/billing → Add $5–10 credit'] as string[]).map((s, i) => (
                    <li key={i} className="flex gap-2.5"><span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-xs font-bold text-[var(--color-primary)]">{i + 1}</span><span>{s}</span></li>
                  ))}
                </ol>
                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium">Paste your Replicate API key</label>
                  <input type="password" value={wizardInputs.replicate} onChange={(e) => setWizardInputs((s) => ({ ...s, replicate: e.target.value }))} placeholder="r8_••••••••••••••••••••••••••••••••••••••••" autoComplete="off" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none" />
                </div>
                {wizardError && <p className="mt-2 text-sm text-red-400">{wizardError}</p>}
                <button onClick={wizardNext} disabled={wizardSaving || !wizardInputs.replicate.trim()} className="mt-6 w-full cursor-pointer rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">{wizardSaving ? 'Saving…' : 'Next →'}</button>
                <button onClick={() => setWizardStep(null)} className="mt-3 w-full cursor-pointer text-xs text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text-muted)]">Skip for now</button>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
                  Replicate key saved
                </div>
                <h2 className="text-xl font-bold">Get your Anthropic API key</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Claude AI enhances prompts for better image and video results. Optional — skip if you prefer manual prompts.</p>
                <ol className="mt-5 space-y-2.5 text-sm text-[var(--color-text-muted)]">
                  {(['console.anthropic.com → Sign up', 'Settings → API Keys → Create key', 'Add $5 credit in Billing'] as string[]).map((s, i) => (
                    <li key={i} className="flex gap-2.5"><span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-xs font-bold text-[var(--color-primary)]">{i + 1}</span><span>{s}</span></li>
                  ))}
                </ol>
                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium">Anthropic API key <span className="font-normal text-[var(--color-text-dim)]">(optional)</span></label>
                  <input type="password" value={wizardInputs.anthropic} onChange={(e) => setWizardInputs((s) => ({ ...s, anthropic: e.target.value }))} placeholder="sk-ant-••••••••••••••••••••••••••••••••••••••••" autoComplete="off" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none" />
                </div>
                {wizardError && <p className="mt-2 text-sm text-red-400">{wizardError}</p>}
                <div className="mt-6 flex gap-3">
                  <button onClick={() => wizardFinish(true)} disabled={wizardSaving} className="flex-1 cursor-pointer rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-white disabled:opacity-40">Skip</button>
                  <button onClick={() => wizardFinish(false)} disabled={wizardSaving || !wizardInputs.anthropic.trim()} className="flex-[2] cursor-pointer rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">{wizardSaving ? 'Saving…' : 'Save & Start →'}</button>
                </div>
                <button onClick={() => setWizardStep(null)} className="mt-3 w-full cursor-pointer text-xs text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text-muted)]">Skip for now</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ HELP DRAWER ════════════════════════════════════════════════════ */}
      {helpOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-[2px]" onClick={() => setHelpOpen(false)} />
          <div className="w-full max-w-sm overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">Help & Instructions</h2>
              <button onClick={() => setHelpOpen(false)} className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-white" aria-label="Close help">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-8 text-sm">
              <div ref={(el) => { helpRefs.current.replicate = el; }}>
                <h3 className="mb-3 font-semibold text-white">Replicate API Key</h3>
                <p className="mb-3 text-[var(--color-text-muted)]">Replicate runs the AI models for video generation. Flux Schnell generates start frames; Kling v2.1 animates them into video.</p>
                <ol className="space-y-2 text-[var(--color-text-muted)]">{(['replicate.com → Sign up (GitHub login works)', 'replicate.com/account/api-tokens → Create token', 'replicate.com/account/billing → Add $5–10 credit', 'Key starts with r8_'] as string[]).map((item, i) => (<li key={i} className="flex gap-2"><span className="shrink-0 font-bold text-[var(--color-primary)]">{i + 1}.</span><span>{item}</span></li>))}</ol>
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">💡 Each 5s video costs ~$0.25–0.50. $5 credit ≈ 10–15 videos.</div>
              </div>
              <hr className="border-[var(--color-border)]" />
              <div ref={(el) => { helpRefs.current.anthropic = el; }}>
                <h3 className="mb-1 font-semibold text-white">Anthropic API Key <span className="text-xs font-normal text-[var(--color-text-dim)]">(optional)</span></h3>
                <p className="mt-2 mb-3 text-[var(--color-text-muted)]">Claude AI enhances both image and video prompts — turns your rough idea into a detailed, optimized prompt.</p>
                <ol className="space-y-2 text-[var(--color-text-muted)]">{(['console.anthropic.com → Sign up', 'Settings → API Keys → Create key', 'Add $5 credit in Billing', 'Key starts with sk-ant-'] as string[]).map((item, i) => (<li key={i} className="flex gap-2"><span className="shrink-0 font-bold text-[var(--color-primary)]">{i + 1}.</span><span>{item}</span></li>))}</ol>
                <div className="mt-3 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3 text-xs text-[var(--color-text-muted)]">💡 Prompt enhancement costs ~$0.001 per call. Highly recommended.</div>
              </div>
              <hr className="border-[var(--color-border)]" />
              <div ref={(el) => { helpRefs.current.tips = el; }}>
                <h3 className="mb-4 font-semibold text-white">Prompt Writing Tips</h3>
                <div className="space-y-3">{[
                  { title: 'Image: be specific about style', body: '"Editorial product photo on white background, soft studio light, razor-sharp focus" beats "a product photo"' },
                  { title: 'Video: describe motion, not subjects', body: '"a cat slowly stretching its paws, fur rippling in a warm breeze" — motion language is key for Kling' },
                  { title: 'For Image→Video: describe the movement', body: '"camera slowly zooms in", "hair blowing in wind", "smoke rising gently", "leaves falling"' },
                  { title: '5s beats 10s for quality', body: 'Shorter videos generate faster and look sharper. Use 10s only for complex scenes.' },
                  { title: 'AI Enhance first', body: 'Even a 3-word idea becomes a detailed, optimized prompt. Always enhance before generating.' },
                ].map(({ title, body: b }) => (
                  <div key={title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <div className="mb-1 font-medium text-white">{title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{b}</div>
                  </div>
                ))}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════════ */}
      <div className={cx('p-6 transition-opacity', wizardStep !== null && 'pointer-events-none select-none opacity-20')}>
        <div className="mx-auto max-w-5xl space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">AI Studio</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Image generation · Photo enhancement · Video generation</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-1">
              <CreditCounter />
              <span className="text-xs text-[var(--color-text-dim)]">{userEmail}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>

          {/* ── Studio tabs ── */}
          <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {([
              { id: 'image' as StudioTab, label: 'Image Generator', desc: 'Flux Schnell · ~$0.003/image' },
              { id: 'video' as StudioTab, label: 'Video Generator', desc: 'Kling v2.0 · ~$0.30–0.60/video' },
            ] as const).map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => setStudioTab(id)}
                className={cx(
                  'flex-1 cursor-pointer rounded-lg px-4 py-3 text-left text-sm transition-colors',
                  studioTab === id ? 'bg-[var(--color-card)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-white',
                )}
              >
                <div className="font-semibold">{label}</div>
                <div className="text-xs opacity-60">{desc}</div>
              </button>
            ))}
          </div>

          {/* ── API Keys (shared) ── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="mb-5 text-base font-semibold">API Keys</h2>
            <div className="space-y-5">
              {([
                { id: 'replicate' as Provider, label: 'Replicate API Key', placeholder: 'r8_••••••••••••••••••••••••••••••••••••••••', hs: 'replicate' as HelpSection, note: 'Optional — for unlimited BYOK access' },
                { id: 'anthropic' as Provider, label: 'Anthropic API Key',  placeholder: 'sk-ant-••••••••••••••••••••••••••••••••••••••••', hs: 'anthropic' as HelpSection, note: 'Optional — AI prompt enhancement' },
              ]).map(({ id, label, placeholder, hs, note }) => {
                const saved = keyFor(id);
                return (
                  <div key={id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]">
                        {label}
                        <span className="text-xs text-[var(--color-text-dim)]">({note})</span>
                        {id === 'replicate' && !saved && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                            Required
                          </span>
                        )}
                      </label>
                      <button onClick={() => openHelp(hs)} className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline">How to get →</button>
                    </div>
                    {saved ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-primary)]"><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
                          <span className="font-mono text-sm text-[var(--color-text-muted)]">{saved.keyHint}</span>
                        </div>
                        <button onClick={() => deleteKey(id)} disabled={keyDeleting[id]} className="cursor-pointer rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40">{keyDeleting[id] ? '…' : 'Delete'}</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="password" value={keyInputs[id]} onChange={(e) => setKeyInputs((s) => ({ ...s, [id]: e.target.value }))} placeholder={placeholder} className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none" />
                        <button onClick={() => saveKey(id)} disabled={keySaving[id] || !keyInputs[id].trim()} className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">{keySaving[id] ? '…' : 'Save'}</button>
                      </div>
                    )}
                    {id === 'replicate' && (
                      <p className="mt-1.5 text-xs text-[var(--color-text-dim)]">
                        Used for both image and video generation. You only need one Replicate account.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              IMAGE TAB
          ══════════════════════════════════════════════════════════════ */}
          {studioTab === 'image' && (
            <div className="space-y-6">

              {/* Image sub-tabs */}
              <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
                {([
                  { id: 'generate' as ImageSubTab, label: 'Generate Image' },
                  { id: 'edit'     as ImageSubTab, label: 'Edit Photo' },
                ] as const).map(({ id, label }) => (
                  <button key={id} onClick={() => setImageSubTab(id)} className={cx('flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors', imageSubTab === id ? 'bg-[var(--color-card)] text-white' : 'text-[var(--color-text-muted)] hover:text-white')}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Generate Image ── */}
              {imageSubTab === 'generate' && (
                <div className="flex gap-6">

                  {/* Controls */}
                  <aside className="w-80 shrink-0 space-y-5">

                    {/* Presets */}
                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Image Type</h3>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(Object.entries(PRESET_MAP) as [PresetKey, typeof PRESET_MAP[PresetKey]][]).map(([key, p]) => {
                          const dims = aspectToPreviewDims(p.aspect_ratio);
                          return (
                            <button key={key} onClick={() => imgSelectPreset(key)} className={cx('flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors', imgSelectedPreset === key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40')}>
                              <div className="flex h-7 w-11 items-center justify-center">
                                <div className="rounded-[2px] bg-current opacity-60" style={{ width: dims.width * 0.5, height: dims.height * 0.5 }} />
                              </div>
                              <span className="text-[10px] font-medium leading-tight">{p.label}</span>
                              <span className="font-mono text-[9px] opacity-50">{p.aspect_ratio}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Prompt */}
                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Prompt</h3>
                        <button onClick={() => openHelp('tips')} className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline">Tips →</button>
                      </div>
                      <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} rows={4} placeholder="A modern barbershop interior, warm lighting, wooden accents…" className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none" />

                      <select value={imgEnhanceMode} onChange={(e) => setImgEnhanceMode(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none">
                        {ENHANCE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>

                      <button onClick={imgHandleEnhance} disabled={!imgPrompt.trim() || imgEnhancing || !keyFor('anthropic')} title={!keyFor('anthropic') ? 'Add Anthropic key to enable' : undefined} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white disabled:opacity-40">
                        {imgEnhancing ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Enhancing…</> : '✦ AI Enhance Prompt'}
                      </button>

                      {imgEnhancedPrompt && (
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Enhanced</span>
                            <button onClick={() => setImgEnhancedPrompt(null)} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-white">✕</button>
                          </div>
                          <p className="text-xs leading-relaxed text-cyan-200">{imgEnhancedPrompt}</p>
                        </div>
                      )}
                    </section>

                    {/* Style tags */}
                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Style Modifiers</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {STYLE_TAGS.map((tag) => (
                          <button key={tag} onClick={() => imgToggleTag(tag)} className={cx('cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors', imgActiveTags.has(tag) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-white')}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Format */}
                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Output Format</h3>
                      <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                        {OUTPUT_FORMATS.map((f) => (
                          <button key={f} onClick={() => setImgOutputFormat(f)} className={cx('flex-1 cursor-pointer border-r border-[var(--color-border)] py-2 text-xs font-bold uppercase tracking-wider transition-colors last:border-r-0', imgOutputFormat === f ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-white')}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </section>

                    {imgError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{imgError}</div>}

                    <button onClick={imgHandleGenerate} disabled={imgGenerating || !(imgEnhancedPrompt ?? imgPrompt).trim() || !keyFor('replicate')} title={!keyFor('replicate') ? 'Add your Replicate API key first → Settings' : undefined} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">
                      {imgGenerating ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</> : <>Generate {imgPreset.display}</>}
                    </button>
                    <p className="text-center text-xs text-[var(--color-text-dim)]">~$0.003 per image · ~$0.001 per AI enhancement</p>
                  </aside>

                  {/* Result */}
                  <main className="flex flex-1 flex-col gap-4">
                    {imgGenerating && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--color-border)] p-16 text-[var(--color-text-muted)]">
                        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)]" />
                        <span className="text-sm">Generating {imgPreset.display} · {imgPreset.aspect_ratio} · {imgOutputFormat}…</span>
                      </div>
                    )}

                    {!imgGenerating && !imgUrl && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] p-16 text-center">
                        <svg width={52} height={52} viewBox="0 0 52 52" fill="none" aria-hidden="true" className="opacity-20">
                          <rect x="6" y="11" width="40" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17" cy="21" r="4.5" stroke="currentColor" strokeWidth="2" />
                          <path d="M6 35l11-9 8 8 6-6 9 7 6-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm text-[var(--color-text-dim)]">Your image will appear here</span>
                      </div>
                    )}

                    {!imgGenerating && imgUrl && imgMeta && (
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgUrl} alt="Generated" className="w-full rounded-xl border border-[var(--color-border)]" />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {[imgMeta.display, imgMeta.ratio, imgMeta.fmt, imgMeta.label].map((tag) => (
                              <span key={tag} className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-dim)]">{tag}</span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => imgHandleDownload(imgUrl, imgMeta)} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white">
                              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 5.5l3 3 3-3M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Download {imgMeta.fmt.toUpperCase()}
                            </button>
                            <button onClick={() => imgLoadIntoEditor(imgUrl)} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white">
                              ✏️ Edit Photo
                            </button>
                            <button onClick={() => animateImage(imgUrl)} disabled={imgAnimating || !keyFor('replicate')} title={!keyFor('replicate') ? 'Add your Replicate API key first → Settings' : undefined} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                              {imgAnimating ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing…</> : <>Animate this →</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </main>
                </div>
              )}

              {/* ── Edit Photo ── */}
              {imageSubTab === 'edit' && (
                <div className="flex gap-6">
                  <aside className="w-80 shrink-0 space-y-4">

                    {/* Upload */}
                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Upload Photo</h3>
                      <input id="edit-file-input" type="file" accept="image/*" className="hidden" onChange={editHandleFileChange} />
                      {!editPreview ? (
                        <label htmlFor="edit-file-input" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40">
                          <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M14 3v16M9 8l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 20v4h20v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span>Choose a photo to edit</span>
                          <span className="text-xs opacity-50">JPEG · PNG · WEBP</span>
                        </label>
                      ) : (
                        <label htmlFor="edit-file-input" className="cursor-pointer text-xs text-[var(--color-primary)] underline underline-offset-2 hover:opacity-75">Change photo</label>
                      )}
                    </section>

                    {editPreview && (
                      <>
                        {/* Level 1: Quick Filters */}
                        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Quick Filters</h3>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {QUICK_FILTERS.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => setEditFilter(f.id)}
                                className={cx(
                                  'flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg p-1 transition-all',
                                  editFilter === f.id
                                    ? 'ring-2 ring-green-400'
                                    : 'ring-1 ring-transparent hover:ring-[var(--color-border)]',
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={editPreview}
                                  alt={f.label}
                                  style={{ filter: f.filter, width: 60, height: 60, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                                />
                                <span className="text-[10px] text-[var(--color-text-muted)]">{f.label}</span>
                              </button>
                            ))}
                          </div>
                        </section>

                        {/* Level 2: Adjust */}
                        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                          <button
                            onClick={() => setEditAdjustOpen((v) => !v)}
                            className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-white"
                          >
                            <span>Adjust</span>
                            <span className="text-xs text-[var(--color-text-muted)]">{editAdjustOpen ? '▲' : '▾'}</span>
                          </button>
                          {editAdjustOpen && (
                            <div className="mt-4 space-y-3">
                              {(([
                                { label: 'Brightness',   value: editBrightness,   setter: (v: number) => setEditBrightness(v),   min: 50,  max: 150 },
                                { label: 'Contrast',     value: editContrast,     setter: (v: number) => setEditContrast(v),     min: 50,  max: 150 },
                                { label: 'Saturation',   value: editSaturation,   setter: (v: number) => setEditSaturation(v),   min: 0,   max: 200 },
                                { label: 'Temperature',  value: editTemperature,  setter: (v: number) => setEditTemperature(v),  min: -50, max: 50  },
                              ]) as Array<{ label: string; value: number; setter: (v: number) => void; min: number; max: number }>).map(({ label, value, setter, min, max }) => (
                                <div key={label}>
                                  <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                                    <span>{label}</span>
                                    <span className="font-mono">{value}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={min}
                                    max={max}
                                    value={value}
                                    onChange={(e) => setter(Number(e.target.value))}
                                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-primary)]"
                                  />
                                </div>
                              ))}
                              <div>
                                <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                                  <span>Sharpness</span>
                                  <span className="font-mono text-[var(--color-text-dim)]">{editSharpness} <span className="opacity-50">(server)</span></span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={editSharpness}
                                  onChange={(e) => setEditSharpness(Number(e.target.value))}
                                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] opacity-40 accent-[var(--color-primary)]"
                                />
                              </div>
                              <button
                                onClick={editResetAdjust}
                                className="cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-white"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </section>

                        {/* Level 2.5: Transform */}
                        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Transform · Free</h3>
                          <div className="mb-3 grid grid-cols-4 gap-1.5">
                            {([
                              { icon: '↺', title: 'Rotate Left',       short: 'L Rotate', active: false, onClick: () => setEditRotation((r) => ((r - 90 + 180) % 360 + 360) % 360 - 180) },
                              { icon: '↻', title: 'Rotate Right',      short: 'R Rotate', active: false, onClick: () => setEditRotation((r) => ((r + 90 + 180) % 360 + 360) % 360 - 180) },
                              { icon: '↔', title: 'Flip Horizontal',   short: 'Flip H',   active: editFlipH, onClick: () => setEditFlipH((v) => !v) },
                              { icon: '↕', title: 'Flip Vertical',     short: 'Flip V',   active: editFlipV, onClick: () => setEditFlipV((v) => !v) },
                            ] as Array<{ icon: string; title: string; short: string; active: boolean; onClick: () => void }>).map(({ icon, title, short, active, onClick }) => (
                              <button
                                key={title}
                                onClick={onClick}
                                title={title}
                                className={cx(
                                  'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border py-2 text-center transition-colors',
                                  active
                                    ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/10 text-white'
                                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-white',
                                )}
                              >
                                <span className="text-base leading-none">{icon}</span>
                                <span className="text-[9px]">{short}</span>
                              </button>
                            ))}
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                              <span>Rotation</span>
                              <span className="font-mono">{editRotation}°</span>
                            </div>
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              value={editRotation}
                              onChange={(e) => setEditRotation(Number(e.target.value))}
                              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-primary)]"
                            />
                          </div>
                          {(editRotation !== 0 || editFlipH || editFlipV) && (
                            <button
                              onClick={() => { setEditRotation(0); setEditFlipH(false); setEditFlipV(false); }}
                              className="mt-3 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-white"
                            >
                              Reset
                            </button>
                          )}
                        </section>

                        {/* Level 3: AI Tools */}
                        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">AI Tools</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { tool: 'upscale'  as const, icon: '🔍', label: 'Upscale 4×',  price: '~$0.10' },
                              { tool: 'face'     as const, icon: '👤', label: 'Face Enhance', price: '~$0.10' },
                              { tool: 'removebg' as const, icon: '✂️', label: 'Remove BG',    price: '~$0.02' },
                              { tool: 'aiedit'   as const, icon: '✨', label: 'AI Edit (Beta)', price: '~$0.03' },
                            ]).map(({ tool, icon, label, price }) => (
                              <button
                                key={tool}
                                onClick={() => {
                                  if (tool === 'aiedit') { setEditAiEditOpen((o) => !o); }
                                  else { editRunAiTool(tool); }
                                }}
                                disabled={!!editAiTool || !keyFor('replicate')}
                                className={cx(
                                  'flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors disabled:opacity-40',
                                  tool === 'aiedit' && editAiEditOpen
                                    ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/10'
                                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40',
                                )}
                              >
                                {editAiTool === tool
                                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                                  : <span className="text-lg leading-none">{icon}</span>
                                }
                                <span className="mt-1 text-xs font-semibold text-white">{label}</span>
                                <span className="text-[10px] text-[var(--color-text-dim)]">{price}</span>
                              </button>
                            ))}
                            <button
                              disabled
                              className="col-span-2 flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] p-3 text-center opacity-35"
                            >
                              <span className="text-lg leading-none">🎨</span>
                              <span className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">Style Transfer</span>
                              <span className="text-[10px] text-[var(--color-text-dim)]">Coming soon</span>
                            </button>
                          </div>

                          {/* AI Edit prompt */}
                          {editAiEditOpen && (
                            <div className="mt-3 space-y-2">
                              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-300">
                                ⚠️ Beta: Works best with style changes (e.g. &quot;make vintage&quot;, &quot;add dramatic shadows&quot;, &quot;change to warm tones&quot;). Does NOT work for rotation, zoom, cropping, or angle changes — use Transform tools above instead.
                              </div>
                              <input
                                type="text"
                                value={editAiEditPrompt}
                                onChange={(e) => setEditAiEditPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && editRunAiEdit()}
                                placeholder="Describe what to change: e.g. 'make it macro close-up', 'change angle to top-down', 'add steam rising from food', 'blur the background'"
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none"
                              />
                              <div className="flex gap-2">
                                {keyFor('anthropic') && (
                                  <button
                                    onClick={editImproveAiEditPrompt}
                                    disabled={editAiEditEnhancing || !editAiEditPrompt.trim()}
                                    className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-white disabled:opacity-40"
                                  >
                                    {editAiEditEnhancing
                                      ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Improving…</>
                                      : '✨ Improve prompt'}
                                  </button>
                                )}
                                <button
                                  onClick={editRunAiEdit}
                                  disabled={!!editAiTool || !editAiEditPrompt.trim() || !keyFor('replicate')}
                                  className="ml-auto cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
                                >
                                  {editAiTool === 'aiedit'
                                    ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Editing…</>
                                    : 'Apply Edit'}
                                </button>
                              </div>
                              <p className="text-[10px] text-[var(--color-text-dim)]">Works in any language: English, Slovak, German, Ukrainian…</p>
                            </div>
                          )}

                          {!keyFor('replicate') && <p className="mt-2 text-xs text-[var(--color-text-dim)]">Add Replicate key to use AI tools</p>}
                        </section>

                        {editAiError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{editAiError}</div>}

                        {/* Format selector */}
                        <div className="space-y-2">
                          <p className="text-xs text-[var(--color-text-muted)]">Export format</p>
                          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                            {(['png', 'jpeg', 'webp'] as const).map((fmt) => {
                              const locked = editIsTransparent && fmt !== 'png';
                              return (
                                <button
                                  key={fmt}
                                  onClick={() => !locked && setEditSaveFormat(fmt)}
                                  disabled={locked}
                                  title={locked ? 'Transparency requires PNG' : undefined}
                                  className={cx(
                                    'flex-1 border-r border-[var(--color-border)] py-2 text-xs font-bold uppercase tracking-wider transition-colors last:border-r-0',
                                    editSaveFormat === fmt && !locked
                                      ? 'bg-green-500/15 text-green-400'
                                      : locked
                                      ? 'cursor-not-allowed text-[var(--color-text-dim)] opacity-35'
                                      : 'cursor-pointer text-[var(--color-text-muted)] hover:text-white',
                                  )}
                                >
                                  {fmt}
                                </button>
                              );
                            })}
                          </div>
                          {editIsTransparent && (
                            <p className="text-[10px] text-amber-400/80">Remove BG active — PNG preserves transparency</p>
                          )}
                        </div>

                        <button
                          onClick={editSaveAndDownload}
                          disabled={editSaving}
                          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40"
                        >
                          {editSaving
                            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Exporting…</>
                            : `Save & Download`}
                        </button>
                        <p className="text-center text-xs text-[var(--color-text-dim)]">AI tools ~$0.02–0.10 via Replicate</p>
                      </>
                    )}
                  </aside>

                  <main className="flex flex-1 flex-col gap-4">
                    {!editPreview ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] p-16 text-center">
                        <svg width={52} height={52} viewBox="0 0 52 52" fill="none" aria-hidden="true" className="opacity-20">
                          <rect x="6" y="11" width="40" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17" cy="21" r="4.5" stroke="currentColor" strokeWidth="2" />
                          <path d="M6 35l11-9 8 8 6-6 9 7 6-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm text-[var(--color-text-dim)]">Upload a photo to start editing</span>
                      </div>
                    ) : editAiEditResult ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Original</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={editPreview!} alt="Original" className="w-full rounded-xl border border-[var(--color-border)]" />
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400">AI Edit Result</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={editAiEditResult} alt="AI Edit Result" className="w-full rounded-xl border border-green-500/30" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => { setEditAiResult(editAiEditResult); setEditAiEditResult(null); setEditAiEditOpen(false); }}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-500"
                          >Accept</button>
                          <button
                            onClick={() => setEditAiEditResult(null)}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-red-500/40 hover:text-red-400"
                          >Reject</button>
                          <button
                            onClick={editAiEditDownload}
                            disabled={editSaving}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white disabled:opacity-40"
                          >
                            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 5.5l3 3 3-3M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Download
                          </button>
                          <button
                            onClick={() => animateImage(editAiEditResult)}
                            disabled={editAnimating || !keyFor('replicate')}
                            title={!keyFor('replicate') ? 'Add your Replicate API key first → Settings' : undefined}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                          >
                            {editAnimating ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing…</> : <>Animate this →</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={editAiResult ?? editPreview}
                            alt="Edit preview"
                            style={{
                              filter: buildEditFilter(editFilter, editBrightness, editContrast, editSaturation, editTemperature),
                              transform: `rotate(${editRotation}deg) scaleX(${editFlipH ? -1 : 1}) scaleY(${editFlipV ? -1 : 1})`,
                              transition: 'transform 0.15s ease',
                            }}
                            className="w-full"
                          />
                          {editAiResult && (
                            <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                              AI Result
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={editAnimate}
                            disabled={editAnimating || !keyFor('replicate')}
                            title={!keyFor('replicate') ? 'Add your Replicate API key first → Settings' : undefined}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                          >
                            {editAnimating
                              ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing…</>
                              : <>Animate this →</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </main>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIDEO TAB
          ══════════════════════════════════════════════════════════════ */}
          {studioTab === 'video' && (
            <div className="space-y-6">

              {/* Mode tabs */}
              <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
                {([
                  { id: 'text'  as VideoMode, label: 'Text → Video',  desc: 'Generate from prompt' },
                  { id: 'image' as VideoMode, label: 'Image → Video', desc: 'Animate your photo'   },
                ] as const).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => { setVideoMode(id); setVidUrl(null); setVidStartImageUrl(null); setVidError(null); setGenStep(null); }}
                    className={cx('flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm transition-colors', videoMode === id ? 'bg-[var(--color-card)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-white')}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs opacity-60">{desc}</div>
                  </button>
                ))}
              </div>

              {/* Skills */}
              <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                <h2 className="mb-4 text-base font-semibold">Video Skill</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {VIDEO_SKILLS.map((skill) => (
                    <button key={skill.id} onClick={() => setSelectedSkill(skill)} className={cx('cursor-pointer rounded-lg border px-3 py-3 text-left text-sm transition-colors', selectedSkill.id === skill.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40')}>
                      <div className="font-medium">{skill.label}</div>
                      <div className="mt-0.5 text-xs opacity-60">{skill.aspectRatio} · {skill.duration}s</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Image upload (Image→Video) */}
              {videoMode === 'image' && (
                <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                  <h2 className="mb-4 text-base font-semibold">Source Image</h2>
                  {vidUploadedUrl ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={vidUploadedUrl} alt="Uploaded" className="max-h-64 w-full object-contain" />
                        <button onClick={() => setVidUploadedUrl(null)} className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove image">
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      <p className="text-xs text-[var(--color-text-dim)]">Image ready. Write a motion prompt below and click Animate.</p>
                    </div>
                  ) : (
                    <div onDragOver={(e) => { e.preventDefault(); setVidDragOver(true); }} onDragLeave={() => setVidDragOver(false)} onDrop={vidHandleDrop} onClick={() => vidFileInputRef.current?.click()} className={cx('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors', vidDragOver ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40')}>
                      {vidUploading ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" /> : (
                        <>
                          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-dim)]" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-muted)]">Drop image here or click to browse</p>
                            <p className="mt-1 text-xs text-[var(--color-text-dim)]">JPG, PNG, WEBP · max 5 MB</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <input ref={vidFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) vidUploadFile(f); e.target.value = ''; }} />
                </section>
              )}

              {/* Prompt */}
              <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{videoMode === 'text' ? 'Prompt' : 'Motion Prompt'}</h2>
                  <button onClick={() => openHelp('tips')} className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline">Prompt tips →</button>
                </div>
                <textarea value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} rows={4} placeholder={videoMode === 'text' ? 'Describe your video idea…' : 'Describe the motion: "camera slowly zooms in", "hair blowing in wind"…'} className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={vidHandleEnhance} disabled={vidEnhancing || !vidPrompt.trim() || !keyFor('anthropic')} title={!keyFor('anthropic') ? 'Add Anthropic key to enable' : undefined} className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white disabled:opacity-40">
                    {vidEnhancing ? <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Enhancing…</span> : '✦ AI Enhance Prompt'}
                  </button>
                  <button onClick={vidHandleGenerate} disabled={isGenerating || !vidPrompt.trim() || !keyFor('replicate') || (videoMode === 'image' && !vidUploadedUrl)} title={!keyFor('replicate') ? 'Add your Replicate API key first → Settings' : undefined} className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">
                    {isGenerating
                      ? <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />{genStep === 'generating-frame' ? 'Generating frame…' : genStep === 'rate-limiting' ? 'Rate limit pause…' : 'Animating…'}</span>
                      : videoMode === 'text' ? 'Generate Video' : 'Animate'}
                  </button>
                </div>
                {!keyFor('replicate') && <p className="text-xs text-[var(--color-text-dim)]">Video generation disabled — add Replicate key above</p>}
                {!keyFor('anthropic') && <p className="text-xs text-[var(--color-text-dim)]">AI Enhance disabled — <button onClick={() => openHelp('anthropic')} className="cursor-pointer text-[var(--color-primary)] hover:underline">add Anthropic key</button></p>}
                <p className="text-xs text-[var(--color-text-dim)]">~$0.30 for 5s video · ~$0.60 for 10s · ~$0.001 per AI enhancement</p>
              </section>

              {/* Error */}
              {vidError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{vidError}</div>}

              {/* Progress */}
              {isGenerating && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
                  <div className={cx('flex items-center gap-4 border-b border-[var(--color-border)] p-5', genStep === 'generating-frame' ? 'opacity-100' : 'opacity-40')}>
                    <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', genStep === 'generating-frame' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : vidStartImageUrl ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
                      {vidStartImageUrl ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> : genStep === 'generating-frame' ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <span className="text-xs font-bold text-[var(--color-text-dim)]">1</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{videoMode === 'text' ? 'Generating start frame with Flux Schnell' : 'Using your uploaded image'}</div>
                      <div className="text-xs text-[var(--color-text-dim)]">{videoMode === 'text' ? 'AI renders the first frame' : 'Your image is the start frame'}</div>
                    </div>
                    {vidStartImageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={vidStartImageUrl} alt="Start frame" className="h-14 w-14 rounded-lg border border-[var(--color-border)] object-cover" />
                    )}
                  </div>

                  {videoMode === 'text' && (
                    <div className={cx('flex items-center gap-4 border-b border-[var(--color-border)] px-5 py-3 transition-opacity', genStep === 'rate-limiting' ? 'opacity-100' : 'opacity-30')}>
                      <div className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs', genStep === 'rate-limiting' ? 'border-amber-400 text-amber-400' : genStep === 'animating' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
                        {genStep === 'rate-limiting' ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : genStep === 'animating' ? <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> : <span className="font-bold text-[var(--color-text-dim)]">·</span>}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-amber-300/80">Waiting for rate limit reset</div>
                        <div className="text-xs text-[var(--color-text-dim)]">Replicate burst=1 · 10s cooldown between Flux and Kling</div>
                      </div>
                    </div>
                  )}

                  <div className={cx('flex items-center gap-4 p-5', genStep === 'animating' ? 'opacity-100' : 'opacity-40')}>
                    <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', genStep === 'animating' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
                      {genStep === 'animating' ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <span className="text-xs font-bold text-[var(--color-text-dim)]">2</span>}
                    </div>
                    <div>
                      <div className="text-sm font-medium">Animating with Kling v2.1</div>
                      <div className="text-xs text-[var(--color-text-dim)]">Up to 5 minutes · {selectedSkill.duration}s {selectedSkill.aspectRatio} video</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Video result */}
              {vidUrl && (
                <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Result</h2>
                    {vidStartImageUrl && <button onClick={() => setVidStartImageUrl(null)} className="cursor-pointer text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]">hide start frame</button>}
                  </div>
                  {vidStartImageUrl && (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={vidStartImageUrl} alt="Start frame" className="h-16 w-16 rounded-lg object-cover" />
                      <div className="text-xs text-[var(--color-text-dim)]"><div className="font-medium text-[var(--color-text-muted)]">Start frame</div><div>Generated by Flux Schnell</div></div>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-2 shrink-0 text-[var(--color-text-dim)]" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                      <div className="text-xs text-[var(--color-text-dim)]"><div className="font-medium text-[var(--color-text-muted)]">Video</div><div>Animated by Kling v2.1</div></div>
                    </div>
                  )}
                  <video src={vidUrl} controls className="w-full rounded-lg" style={{ maxHeight: selectedSkill.aspectRatio === '9:16' ? '70vh' : '50vh', objectFit: 'contain' }} />
                  <a href={vidUrl} download="generated-video.mp4" className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download MP4
                  </a>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ HELP FAB ═══════════════════════════════════════════════════════ */}
      <button onClick={() => openHelp('replicate')} className="fixed bottom-6 right-6 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-muted)] shadow-xl transition-all hover:border-[var(--color-primary)]/60 hover:text-white" aria-label="Open help">
        <span className="text-base font-bold">?</span>
      </button>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        type={upgradeType}
      />
    </div>
  );
}
