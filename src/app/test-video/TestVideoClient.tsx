'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { VideoSkill, ApiKeyInfo } from '@/lib/types';

// ─── Skills ───────────────────────────────────────────────────────────────────

const VIDEO_SKILLS: VideoSkill[] = [
  { id: 'ig-reel',   label: 'Instagram Reel',     aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a creative director for Instagram Reels. Transform the user input into a cinematic, visually engaging video prompt optimized for vertical 9:16 format. Focus on dynamic motion, vibrant colors, trend-forward aesthetics, and hook within the first second. Output ONLY the enhanced prompt, no explanations.' },
  { id: 'ig-story',  label: 'Instagram Story',    aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a social media content director specializing in Instagram Stories. Transform the user input into a visually compelling 9:16 video prompt with a clear narrative arc fitting 5 seconds. Emphasize authenticity and a strong emotional hook. Output ONLY the enhanced prompt.' },
  { id: 'ig-post',   label: 'Instagram Post',     aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are a visual content creator for Instagram feed posts. Transform the user input into a square 1:1 video prompt with polished, editorial aesthetics. Focus on centered composition and product-forward storytelling. Output ONLY the enhanced prompt.' },
  { id: 'yt-shorts', label: 'YouTube Shorts',     aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a YouTube Shorts content strategist. Transform the user input into an engaging 9:16 vertical video prompt designed to maximize watch time for 10 seconds. Lead with a striking visual and create a satisfying conclusion. Output ONLY the enhanced prompt.' },
  { id: 'tiktok',    label: 'TikTok',             aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a TikTok creative director. Transform the user input into a viral-optimized 9:16 video prompt. Prioritize authenticity, trending visual language, and a surprising element. Output ONLY the enhanced prompt.' },
  { id: 'cinematic', label: 'Cinematic',          aspectRatio: '16:9', duration: 10, systemPrompt: 'You are a cinematic director of photography. Transform the user input into a high-end cinematic video prompt in 16:9 widescreen. Describe lighting, camera movement, depth of field, and atmospheric mood. Output ONLY the enhanced prompt.' },
  { id: 'product',   label: 'Product Showcase',   aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are an e-commerce video director. Transform the user input into a clean product showcase video prompt in 1:1 format. Focus on 360° reveal, material texture, subtle motion, and premium feel. Output ONLY the enhanced prompt.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider    = 'replicate' | 'anthropic';
type HelpSection = 'replicate' | 'anthropic' | 'tips';

interface Props { userId: string; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestVideoClient({ userId: _userId }: Props) {

  // ── Keys ──────────────────────────────────────────────────────────────────
  const [keys,        setKeys]        = useState<ApiKeyInfo[]>([]);
  const [keysLoaded,  setKeysLoaded]  = useState(false);
  const [keyInputs,   setKeyInputs]   = useState<Record<Provider, string>>({ replicate: '', anthropic: '' });
  const [keySaving,   setKeySaving]   = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });
  const [keyDeleting, setKeyDeleting] = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });

  // ── Wizard ────────────────────────────────────────────────────────────────
  const [wizardStep,   setWizardStep]   = useState<1 | 2 | null>(null);
  const [wizardInputs, setWizardInputs] = useState<Record<Provider, string>>({ replicate: '', anthropic: '' });
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardError,  setWizardError]  = useState<string | null>(null);

  // ── Help drawer ───────────────────────────────────────────────────────────
  const [helpOpen,    setHelpOpen]    = useState(false);
  const [helpSection, setHelpSection] = useState<HelpSection>('replicate');
  const helpRefs = useRef<Partial<Record<HelpSection, HTMLElement | null>>>({});

  // ── Video ─────────────────────────────────────────────────────────────────
  const [selectedSkill, setSelectedSkill] = useState<VideoSkill>(VIDEO_SKILLS[0]);
  const [prompt,    setPrompt]    = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videoUrl,  setVideoUrl]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // ── Init: load keys + decide wizard ──────────────────────────────────────
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

  // Scroll help drawer to section when opened
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

  // ── Main page key ops ─────────────────────────────────────────────────────
  async function saveKey(provider: Provider) {
    const key = keyInputs[provider].trim();
    if (!key) return;
    setKeySaving((s) => ({ ...s, [provider]: true }));
    setError(null);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKeyInputs((s) => ({ ...s, [provider]: '' }));
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save key');
    } finally {
      setKeySaving((s) => ({ ...s, [provider]: false }));
    }
  }

  async function deleteKey(provider: Provider) {
    const k = keyFor(provider);
    if (!k) return;
    setKeyDeleting((s) => ({ ...s, [provider]: true }));
    try {
      await fetch(`/api/user/api-keys/${k.id}`, { method: 'DELETE' });
      await loadKeys();
    } finally {
      setKeyDeleting((s) => ({ ...s, [provider]: false }));
    }
  }

  // ── Wizard key ops ────────────────────────────────────────────────────────
  async function wizardSave(provider: Provider): Promise<boolean> {
    const key = wizardInputs[provider].trim();
    if (!key) return false;
    setWizardSaving(true);
    setWizardError(null);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to save key');
      }
      await loadKeys();
      return true;
    } catch (e) {
      setWizardError(e instanceof Error ? e.message : 'Failed to save key');
      return false;
    } finally {
      setWizardSaving(false);
    }
  }

  async function wizardNext() {
    const ok = await wizardSave('replicate');
    if (ok) setWizardStep(2);
  }

  async function wizardFinish(skip: boolean) {
    if (!skip && wizardInputs.anthropic.trim()) {
      const ok = await wizardSave('anthropic');
      if (!ok) return;
    }
    setWizardStep(null);
  }

  // ── Video ops ─────────────────────────────────────────────────────────────
  async function enhancePrompt() {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, skillId: selectedSkill.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enhance');
      setPrompt(data.enhanced);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhance failed');
    } finally {
      setEnhancing(false);
    }
  }

  async function generateVideo() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setVideoUrl(null);
    setError(null);
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, skillId: selectedSkill.id, aspectRatio: selectedSkill.aspectRatio, duration: selectedSkill.duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setVideoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function openHelp(section: HelpSection) {
    setHelpSection(section);
    setHelpOpen(true);
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!keysLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ══ ONBOARDING WIZARD ══════════════════════════════════════════════ */}
      {wizardStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-2xl">

            {/* Progress bar */}
            <div className="mb-7 flex items-center gap-2">
              <div className={cx('h-1.5 flex-1 rounded-full transition-colors', 'bg-[var(--color-primary)]')} />
              <div className={cx('h-1.5 flex-1 rounded-full transition-colors', wizardStep === 2 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]')} />
              <span className="ml-2 shrink-0 text-xs text-[var(--color-text-dim)]">Step {wizardStep} of 2</span>
            </div>

            {/* ─ Step 1: Replicate ─ */}
            {wizardStep === 1 && (
              <>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]" aria-hidden="true">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Get your Replicate API key</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Replicate is an AI platform that runs video generation models. You&apos;ll need an API key and at least $5 credit.
                </p>
                <ol className="mt-5 space-y-2.5 text-sm text-[var(--color-text-muted)]">
                  {[
                    <>Go to <span className="font-medium text-white">replicate.com</span> → Sign up (GitHub login works)</>,
                    <>Go to <span className="font-medium text-white">replicate.com/account/api-tokens</span> → Create token</>,
                    <>Go to <span className="font-medium text-white">replicate.com/account/billing</span> → Add $5–10 credit</>,
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-xs font-bold text-[var(--color-primary)]">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium">Paste your Replicate API key</label>
                  <input
                    type="password"
                    value={wizardInputs.replicate}
                    onChange={(e) => setWizardInputs((s) => ({ ...s, replicate: e.target.value }))}
                    placeholder="r8_••••••••••••••••••••••••••••••••••••••••"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
                {wizardError && <p className="mt-2 text-sm text-red-400">{wizardError}</p>}
                <button
                  onClick={wizardNext}
                  disabled={wizardSaving || !wizardInputs.replicate.trim()}
                  className="mt-6 w-full rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40 cursor-pointer"
                >
                  {wizardSaving ? 'Saving…' : 'Next →'}
                </button>
              </>
            )}

            {/* ─ Step 2: Anthropic ─ */}
            {wizardStep === 2 && (
              <>
                <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                  Replicate key saved
                </div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]" aria-hidden="true">
                    <path d="M12 2a9.96 9.96 0 0 1 6.29 2.23"/><path d="M21.17 8A10 10 0 1 1 8 2.83"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Get your Anthropic API key</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Anthropic&apos;s Claude AI will enhance your prompts for better video results. This step is optional — you can write prompts manually.
                </p>
                <ol className="mt-5 space-y-2.5 text-sm text-[var(--color-text-muted)]">
                  {[
                    <>Go to <span className="font-medium text-white">console.anthropic.com</span> → Sign up</>,
                    <>Settings → API Keys → Create key</>,
                    <>Add $5 credit in Billing</>,
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-xs font-bold text-[var(--color-primary)]">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium">
                    Paste your Anthropic API key{' '}
                    <span className="font-normal text-[var(--color-text-dim)]">(optional)</span>
                  </label>
                  <input
                    type="password"
                    value={wizardInputs.anthropic}
                    onChange={(e) => setWizardInputs((s) => ({ ...s, anthropic: e.target.value }))}
                    placeholder="sk-ant-••••••••••••••••••••••••••••••••••••••••"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
                {wizardError && <p className="mt-2 text-sm text-red-400">{wizardError}</p>}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => wizardFinish(true)}
                    disabled={wizardSaving}
                    className="flex-1 rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => wizardFinish(false)}
                    disabled={wizardSaving || !wizardInputs.anthropic.trim()}
                    className="flex-[2] rounded-xl bg-[var(--color-primary)] py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40 cursor-pointer"
                  >
                    {wizardSaving ? 'Saving…' : 'Save & Start →'}
                  </button>
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
              <button
                onClick={() => setHelpOpen(false)}
                className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-white cursor-pointer"
                aria-label="Close help"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-8 text-sm">

              {/* ─ Replicate ─ */}
              <div ref={(el) => { helpRefs.current.replicate = el; }}>
                <h3 className="mb-3 font-semibold text-white">Replicate API Key</h3>
                <p className="mb-3 text-[var(--color-text-muted)]">Replicate runs AI models in the cloud. Kling v2.0 generates high-quality videos from text prompts.</p>
                <ol className="space-y-2 text-[var(--color-text-muted)]">
                  {[
                    <><span className="text-white">replicate.com</span> → Sign up (GitHub login works)</>,
                    <><span className="text-white">replicate.com/account/api-tokens</span> → Create token</>,
                    <><span className="text-white">replicate.com/account/billing</span> → Add $5–10 credit</>,
                    <>Key starts with <span className="font-mono text-white">r8_</span></>,
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-bold text-[var(--color-primary)]">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-300">
                  💡 Each 5s video costs ~$0.25–0.50. A $5 credit gives you ~10–20 videos.
                </div>
              </div>

              <hr className="border-[var(--color-border)]" />

              {/* ─ Anthropic ─ */}
              <div ref={(el) => { helpRefs.current.anthropic = el; }}>
                <h3 className="mb-1 font-semibold text-white">Anthropic API Key</h3>
                <span className="text-xs text-[var(--color-text-dim)]">Optional — for AI Enhance Prompt</span>
                <p className="mt-2 mb-3 text-[var(--color-text-muted)]">Claude AI turns your raw idea into a detailed video prompt that produces much better results.</p>
                <ol className="space-y-2 text-[var(--color-text-muted)]">
                  {[
                    <><span className="text-white">console.anthropic.com</span> → Sign up</>,
                    <>Settings → API Keys → Create key</>,
                    <>Add $5 credit in Billing</>,
                    <>Key starts with <span className="font-mono text-white">sk-ant-</span></>,
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-bold text-[var(--color-primary)]">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/8 p-3 text-xs text-[var(--color-text-muted)]">
                  💡 Prompt enhancement costs ~$0.001 per call. Highly recommended for better videos.
                </div>
              </div>

              <hr className="border-[var(--color-border)]" />

              {/* ─ Tips ─ */}
              <div ref={(el) => { helpRefs.current.tips = el; }}>
                <h3 className="mb-4 font-semibold text-white">Prompt Writing Tips</h3>
                <div className="space-y-3">
                  {[
                    { title: 'Describe motion, not just subjects', body: 'Instead of "a cat", write "a cat slowly stretching its paws, fur rippling gently in a warm breeze"' },
                    { title: 'Mention lighting & mood', body: '"golden hour sunlight", "soft studio lighting", "dramatic shadows", "neon glow at night"' },
                    { title: '5s beats 10s for quality', body: 'Shorter videos generate faster and look sharper. Use 10s only for complex cinematic scenes.' },
                    { title: 'Use AI Enhance first', body: 'Even a 3-word idea becomes a detailed, optimized prompt. Always enhance before generating.' },
                    { title: 'Match skill to platform', body: 'Instagram Reel ≠ Cinematic. Each skill uses a different prompt style tuned for its platform.' },
                  ].map(({ title, body }) => (
                    <div key={title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                      <div className="mb-1 font-medium text-white">{title}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════════ */}
      <div className={cx('p-6 transition-opacity', wizardStep !== null && 'pointer-events-none select-none opacity-20')}>
        <div className="mx-auto max-w-3xl space-y-8">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">Video Generator</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">AI-powered video generation with Kling v2.0 via Replicate</p>
          </div>

          {/* ── API Keys section ── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="mb-5 text-base font-semibold">API Keys</h2>
            <div className="space-y-5">
              {([
                { id: 'replicate' as Provider, label: 'Replicate API Key', placeholder: 'r8_••••••••••••••••••••••••••••••••••••••••', hs: 'replicate' as HelpSection },
                { id: 'anthropic' as Provider, label: 'Anthropic API Key', placeholder: 'sk-ant-••••••••••••••••••••••••••••••••••••••••', hs: 'anthropic' as HelpSection },
              ]).map(({ id, label, placeholder, hs }) => {
                const saved = keyFor(id);
                return (
                  <div key={id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-sm font-medium text-[var(--color-text-muted)]">
                        {label}
                        {id === 'anthropic' && <span className="ml-1.5 text-xs text-[var(--color-text-dim)]">(optional)</span>}
                      </label>
                      <button onClick={() => openHelp(hs)} className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">
                        How to get this key →
                      </button>
                    </div>
                    {saved ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-primary)]">
                            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                          <span className="font-mono text-sm text-[var(--color-text-muted)]">{saved.keyHint}</span>
                        </div>
                        <button
                          onClick={() => deleteKey(id)}
                          disabled={keyDeleting[id]}
                          className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                        >
                          {keyDeleting[id] ? '…' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={keyInputs[id]}
                          onChange={(e) => setKeyInputs((s) => ({ ...s, [id]: e.target.value }))}
                          placeholder={placeholder}
                          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none"
                        />
                        <button
                          onClick={() => saveKey(id)}
                          disabled={keySaving[id] || !keyInputs[id].trim()}
                          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40 cursor-pointer"
                        >
                          {keySaving[id] ? '…' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Skills section ── */}
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="mb-4 text-base font-semibold">Video Skill</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {VIDEO_SKILLS.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={cx(
                    'rounded-lg border px-3 py-3 text-left text-sm transition-colors cursor-pointer',
                    selectedSkill.id === skill.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40',
                  )}
                >
                  <div className="font-medium">{skill.label}</div>
                  <div className="mt-0.5 text-xs opacity-60">{skill.aspectRatio} · {skill.duration}s</div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Prompt section ── */}
          <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Prompt</h2>
              <button onClick={() => openHelp('tips')} className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">
                Prompt tips →
              </button>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe your video idea…"
              className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-primary)] focus:outline-none"
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={enhancePrompt}
                disabled={enhancing || !prompt.trim() || !keyFor('anthropic')}
                title={!keyFor('anthropic') ? 'Add Anthropic key to enable AI Enhance' : undefined}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                {enhancing
                  ? <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Enhancing…</span>
                  : '✦ AI Enhance Prompt'}
              </button>

              <button
                onClick={generateVideo}
                disabled={generating || !prompt.trim() || !keyFor('replicate')}
                className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40 cursor-pointer"
              >
                {generating
                  ? <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</span>
                  : 'Generate Video'}
              </button>
            </div>

            {!keyFor('anthropic') && (
              <p className="text-xs text-[var(--color-text-dim)]">
                AI Enhance disabled —{' '}
                <button onClick={() => openHelp('anthropic')} className="text-[var(--color-primary)] hover:underline cursor-pointer">
                  add Anthropic key
                </button>
              </p>
            )}
          </section>

          {/* ── Error ── */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          )}

          {/* ── Generating progress ── */}
          {generating && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              <p className="text-sm text-[var(--color-text-muted)]">Generating with Kling v2.0… this may take up to 5 minutes</p>
            </div>
          )}

          {/* ── Video result ── */}
          {videoUrl && (
            <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h2 className="text-base font-semibold">Result</h2>
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg"
                style={{ maxHeight: selectedSkill.aspectRatio === '9:16' ? '70vh' : '50vh', objectFit: 'contain' }}
              />
              <a
                href={videoUrl}
                download="generated-video.mp4"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download MP4
              </a>
            </section>
          )}
        </div>
      </div>

      {/* ══ HELP FAB ═══════════════════════════════════════════════════════ */}
      <button
        onClick={() => openHelp('replicate')}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-muted)] shadow-xl transition-all hover:border-[var(--color-primary)]/60 hover:text-white cursor-pointer"
        aria-label="Open help"
      >
        <span className="text-base font-bold">?</span>
      </button>
    </div>
  );
}
