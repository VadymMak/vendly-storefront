'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { VideoSkill, ApiKeyInfo } from '@/lib/types';

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

const ENHANCE_PHOTO_TYPES = [
  { value: 'sharpen',  label: 'Sharpen & Denoise', desc: 'Remove noise, sharpen edges' },
  { value: 'brighten', label: 'Brighten',          desc: 'Increase exposure'           },
  { value: 'upscale',  label: 'Upscale 4×',        desc: 'Upscale 4×'                  },
  { value: 'portrait', label: 'Portrait',          desc: 'Portrait enhance'            },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioTab      = 'image' | 'video';
type ImageSubTab    = 'generate' | 'enhance';
type VideoMode      = 'text' | 'image';
type GenStep        = 'generating-frame' | 'rate-limiting' | 'animating' | null;
type Provider       = 'replicate' | 'anthropic';
type HelpSection    = 'replicate' | 'anthropic' | 'tips';
type PresetKey      = keyof typeof PRESET_MAP;
type OutputFormat   = typeof OUTPUT_FORMATS[number];
type EnhancePhotoType = typeof ENHANCE_PHOTO_TYPES[number]['value'];

interface ImageMeta { display: string; ratio: string; fmt: OutputFormat; label: string; }
interface Props { userId: string; }

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioClient({ userId: _userId }: Props) {
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
  // Enhance photo sub-tab
  const [enhanceFile,    setEnhanceFile]    = useState<File | null>(null);
  const [enhancePreview, setEnhancePreview] = useState<string | null>(null);
  const [enhanceType,    setEnhanceType]    = useState<EnhancePhotoType>('sharpen');
  const [enhanceResult,  setEnhanceResult]  = useState<string | null>(null);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceError,   setEnhanceError]   = useState<string | null>(null);

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

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/user/api-keys');
      if (res.ok) {
        const data: ApiKeyInfo[] = await res.json();
        setKeys(data);
        if (!data.find((k) => k.provider === 'replicate')) setWizardStep(1);
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
    try {
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalPrompt, aspect_ratio: preset.aspect_ratio, megapixels: preset.megapixels, target_width: preset.target_width, target_height: preset.target_height, output_format: imgOutputFormat }) });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Generation failed'); }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
      setImgMeta({ display: preset.display, ratio: preset.aspect_ratio, fmt: imgOutputFormat, label: preset.label });
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

  // ── Image tab: enhance photo ──────────────────────────────────────────────
  function imgHandleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setEnhanceFile(file);
    setEnhanceResult(null);
    setEnhanceError(null);
    setEnhancePreview(file ? URL.createObjectURL(file) : null);
  }

  async function imgHandleEnhancePhoto() {
    if (!enhanceFile || enhanceLoading) return;
    setEnhanceLoading(true);
    setEnhanceError(null);
    setEnhanceResult(null);
    try {
      const fd = new FormData();
      fd.append('image', enhanceFile);
      fd.append('type', enhanceType);
      const res = await fetch('/api/enhance-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (!data.url) throw new Error('No URL returned');
      setEnhanceResult(data.url);
    } catch (e) { setEnhanceError(e instanceof Error ? e.message : 'Error'); }
    finally { setEnhanceLoading(false); }
  }

  async function imgDownloadEnhanced(url: string) {
    try {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await (await fetch(url)).blob()), download: `enhanced-${Date.now()}.png` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* silent */ }
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

  async function vidHandleGenerate() {
    if (!vidPrompt.trim()) return;
    setVidError(null);
    setVidUrl(null);
    setVidStartImageUrl(null);

    if (videoMode === 'text') {
      setGenStep('generating-frame');
      const frameRes = await fetch('/api/generate-start-frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, aspectRatio: selectedSkill.aspectRatio }) });
      const frameData = await frameRes.json() as { url?: string; error?: string };
      if (!frameRes.ok) { setVidError(frameData.error ?? 'Frame generation failed'); setGenStep(null); return; }
      setVidStartImageUrl(frameData.url ?? null);
      setGenStep('rate-limiting');
      await new Promise((r) => setTimeout(r, 10000));
      setGenStep('animating');
      const videoRes = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: frameData.url }) });
      const videoData = await videoRes.json() as { url?: string; error?: string };
      if (!videoRes.ok) { setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }
      setVidUrl(videoData.url ?? null);
    } else {
      if (!vidUploadedUrl) { setVidError('Please upload an image first'); return; }
      setGenStep('animating');
      const videoRes = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: vidPrompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration, startImage: vidUploadedUrl }) });
      const videoData = await videoRes.json() as { url?: string; error?: string };
      if (!videoRes.ok) { setVidError(videoData.error ?? 'Video generation failed'); setGenStep(null); return; }
      setVidUrl(videoData.url ?? null);
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
          <div>
            <h1 className="text-2xl font-bold">AI Studio</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Image generation · Photo enhancement · Video generation</p>
          </div>

          {/* ── Studio tabs ── */}
          <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {([
              { id: 'image' as StudioTab, label: 'Image Generator', desc: 'Flux Schnell · free tier' },
              { id: 'video' as StudioTab, label: 'Video Generator', desc: 'Kling v2.1 · your Replicate key' },
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
                { id: 'replicate' as Provider, label: 'Replicate API Key', placeholder: 'r8_••••••••••••••••••••••••••••••••••••••••', hs: 'replicate' as HelpSection, note: 'Required for Video Generator' },
                { id: 'anthropic' as Provider, label: 'Anthropic API Key',  placeholder: 'sk-ant-••••••••••••••••••••••••••••••••••••••••', hs: 'anthropic' as HelpSection, note: 'Optional — AI prompt enhancement' },
              ]).map(({ id, label, placeholder, hs, note }) => {
                const saved = keyFor(id);
                return (
                  <div key={id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-muted)]">{label} <span className="ml-1 text-xs text-[var(--color-text-dim)]">({note})</span></label>
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
                  { id: 'enhance'  as ImageSubTab, label: 'Enhance Photo' },
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

                    <button onClick={imgHandleGenerate} disabled={imgGenerating || !(imgEnhancedPrompt ?? imgPrompt).trim()} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">
                      {imgGenerating ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</> : <>Generate {imgPreset.display}</>}
                    </button>
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
                            <button onClick={() => animateImage(imgUrl)} disabled={imgAnimating} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                              {imgAnimating ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing…</> : <>Animate this →</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </main>
                </div>
              )}

              {/* ── Enhance Photo ── */}
              {imageSubTab === 'enhance' && (
                <div className="flex gap-6">
                  <aside className="w-80 shrink-0 space-y-5">

                    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Upload Photo</h3>
                      <input id="enhance-file-input" type="file" accept="image/*" className="hidden" onChange={imgHandleFileChange} />
                      {!enhancePreview ? (
                        <label htmlFor="enhance-file-input" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40">
                          <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M14 3v16M9 8l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 20v4h20v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span>Choose a photo to enhance</span>
                          <span className="text-xs opacity-50">JPEG · PNG · WEBP</span>
                        </label>
                      ) : (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={enhancePreview} alt="Preview" className="max-h-48 w-full rounded-lg border border-[var(--color-border)] object-contain" />
                          <label htmlFor="enhance-file-input" className="cursor-pointer text-xs text-[var(--color-primary)] underline underline-offset-2 hover:opacity-75">Change photo</label>
                        </div>
                      )}
                    </section>

                    <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Enhancement Type</h3>
                      {ENHANCE_PHOTO_TYPES.map((t) => (
                        <button key={t.value} onClick={() => setEnhanceType(t.value)} className={cx('flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors', enhanceType === t.value ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40')}>
                          <div className={cx('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2', enhanceType === t.value ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]')}>
                            {enhanceType === t.value && <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{t.label}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{t.desc}</div>
                          </div>
                        </button>
                      ))}
                    </section>

                    {enhanceError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{enhanceError}</div>}

                    <button onClick={imgHandleEnhancePhoto} disabled={!enhanceFile || enhanceLoading} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">
                      {enhanceLoading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Processing…</> : 'Enhance Photo'}
                    </button>
                  </aside>

                  <main className="flex flex-1 flex-col gap-4">
                    {enhanceLoading && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--color-border)] p-16 text-[var(--color-text-muted)]">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        <span className="text-sm">Processing image…</span>
                      </div>
                    )}
                    {!enhanceLoading && !enhanceResult && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] p-16 text-center">
                        <svg width={52} height={52} viewBox="0 0 52 52" fill="none" aria-hidden="true" className="opacity-20">
                          <rect x="6" y="11" width="40" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
                          <path d="M18 26l6 6 10-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm text-[var(--color-text-dim)]">Result will appear here</span>
                      </div>
                    )}
                    {!enhanceLoading && enhanceResult && enhancePreview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Original</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={enhancePreview} alt="Original" className="w-full rounded-xl border border-[var(--color-border)]" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Result</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={enhanceResult} alt="Enhanced" className="w-full rounded-xl border border-[var(--color-border)]" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => imgDownloadEnhanced(enhanceResult)} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white">
                            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M3 5.5l3 3 3-3M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Download PNG
                          </button>
                          <button onClick={() => animateImage(enhanceResult)} disabled={imgAnimating} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                            {imgAnimating ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Preparing…</> : <>Animate this →</>}
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
                  <button onClick={vidHandleGenerate} disabled={isGenerating || !vidPrompt.trim() || !keyFor('replicate') || (videoMode === 'image' && !vidUploadedUrl)} className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40">
                    {isGenerating
                      ? <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />{genStep === 'generating-frame' ? 'Generating frame…' : genStep === 'rate-limiting' ? 'Rate limit pause…' : 'Animating…'}</span>
                      : videoMode === 'text' ? 'Generate Video' : 'Animate'}
                  </button>
                </div>
                {!keyFor('replicate') && <p className="text-xs text-[var(--color-text-dim)]">Video generation disabled — add Replicate key above</p>}
                {!keyFor('anthropic') && <p className="text-xs text-[var(--color-text-dim)]">AI Enhance disabled — <button onClick={() => openHelp('anthropic')} className="cursor-pointer text-[var(--color-primary)] hover:underline">add Anthropic key</button></p>}
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
    </div>
  );
}
