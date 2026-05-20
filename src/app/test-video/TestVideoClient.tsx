'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VideoSkill, ApiKeyInfo } from '@/lib/types';

// ─── Skills data ──────────────────────────────────────────────────────────────

const VIDEO_SKILLS: VideoSkill[] = [
  {
    id: 'ig-reel',
    label: 'Instagram Reel',
    aspectRatio: '9:16',
    duration: 5,
    systemPrompt:
      'You are a creative director for Instagram Reels. Transform the user input into a cinematic, visually engaging video prompt optimized for vertical 9:16 format. Focus on dynamic motion, vibrant colors, trend-forward aesthetics, and hook within the first second. Output ONLY the enhanced prompt, no explanations.',
  },
  {
    id: 'ig-story',
    label: 'Instagram Story',
    aspectRatio: '9:16',
    duration: 5,
    systemPrompt:
      'You are a social media content director specializing in Instagram Stories. Transform the user input into a visually compelling 9:16 video prompt with a clear narrative arc fitting 5 seconds. Emphasize authenticity, bold text overlays potential, and a strong emotional hook. Output ONLY the enhanced prompt.',
  },
  {
    id: 'ig-post',
    label: 'Instagram Post',
    aspectRatio: '1:1',
    duration: 5,
    systemPrompt:
      'You are a visual content creator for Instagram feed posts. Transform the user input into a square 1:1 video prompt with polished, editorial aesthetics. Focus on centered composition, clean backgrounds, and product-forward or lifestyle storytelling. Output ONLY the enhanced prompt.',
  },
  {
    id: 'yt-shorts',
    label: 'YouTube Shorts',
    aspectRatio: '9:16',
    duration: 10,
    systemPrompt:
      'You are a YouTube Shorts content strategist. Transform the user input into an engaging 9:16 vertical video prompt designed to maximize watch time for 10 seconds. Lead with a striking visual, maintain energy throughout, and create a satisfying conclusion. Output ONLY the enhanced prompt.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    aspectRatio: '9:16',
    duration: 10,
    systemPrompt:
      'You are a TikTok creative director. Transform the user input into a viral-optimized 9:16 video prompt. Prioritize authenticity, trending visual language, fast cuts potential, satisfying transitions, and a surprising or delightful element. Output ONLY the enhanced prompt.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    aspectRatio: '16:9',
    duration: 10,
    systemPrompt:
      'You are a cinematic director of photography. Transform the user input into a high-end cinematic video prompt in 16:9 widescreen. Describe lighting, camera movement, depth of field, color grading, and atmospheric mood in precise technical language. Output ONLY the enhanced prompt.',
  },
  {
    id: 'product',
    label: 'Product Showcase',
    aspectRatio: '1:1',
    duration: 5,
    systemPrompt:
      'You are an e-commerce video director. Transform the user input into a clean, professional product showcase video prompt in 1:1 format. Focus on 360° reveal, material texture close-ups, subtle motion, neutral or branded backgrounds, and premium feel. Output ONLY the enhanced prompt.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
}

type Provider = 'replicate' | 'anthropic';

export default function TestVideoClient({ userId: _userId }: Props) {
  // API keys state
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>({ replicate: '', anthropic: '' });
  const [keySaving, setKeySaving] = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });
  const [keyDeleting, setKeyDeleting] = useState<Record<Provider, boolean>>({ replicate: false, anthropic: false });

  // Video state
  const [selectedSkill, setSelectedSkill] = useState<VideoSkill>(VIDEO_SKILLS[0]);
  const [prompt, setPrompt] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/user/api-keys');
    if (res.ok) setKeys(await res.json());
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const keyFor = (provider: Provider) => keys.find((k) => k.provider === provider);

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
    setError(null);
    try {
      await fetch(`/api/user/api-keys/${k.id}`, { method: 'DELETE' });
      await loadKeys();
    } finally {
      setKeyDeleting((s) => ({ ...s, [provider]: false }));
    }
  }

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
        body: JSON.stringify({
          prompt,
          skillId: selectedSkill.id,
          aspectRatio: selectedSkill.aspectRatio,
          duration: selectedSkill.duration,
        }),
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

  const PROVIDERS: { id: Provider; label: string; placeholder: string }[] = [
    { id: 'replicate', label: 'Replicate API Key', placeholder: 'r8_••••••••••••••••••••••••••••••••••••••••' },
    { id: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-••••••••••••••••••••••••••••••••••••••••' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Video Generator</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">AI-powered video generation with Kling v2.0 via Replicate</p>
        </div>

        {/* ── API Keys ── */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="mb-4 text-base font-semibold">API Keys</h2>
          <div className="space-y-4">
            {PROVIDERS.map(({ id, label, placeholder }) => {
              const saved = keyFor(id);
              return (
                <div key={id}>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-muted)]">{label}</label>
                  {saved ? (
                    <div className="flex items-center gap-3">
                      <span className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm text-[var(--color-text-muted)]">
                        {saved.keyHint}
                      </span>
                      <button
                        onClick={() => deleteKey(id)}
                        disabled={keyDeleting[id]}
                        className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                      >
                        {keyDeleting[id] ? '...' : 'Delete'}
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
                        {keySaving[id] ? '...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Skills ── */}
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

        {/* ── Prompt + Generate ── */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
          <h2 className="text-base font-semibold">Prompt</h2>

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
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              {enhancing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enhancing…
                </span>
              ) : (
                '✦ AI Enhance Prompt'
              )}
            </button>

            <button
              onClick={generateVideo}
              disabled={generating || !prompt.trim() || !keyFor('replicate')}
              className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-40 cursor-pointer"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </span>
              ) : (
                'Generate Video'
              )}
            </button>
          </div>

          {!keyFor('replicate') && (
            <p className="text-xs text-amber-400">Add your Replicate API key above to generate videos.</p>
          )}
          {!keyFor('anthropic') && (
            <p className="text-xs text-amber-400">Add your Anthropic API key above to use AI Enhance.</p>
          )}
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Generating indicator ── */}
        {generating && !videoUrl && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <p className="text-sm text-[var(--color-text-muted)]">Generating video with Kling v2.0… this may take up to 5 minutes</p>
          </div>
        )}

        {/* ── Video result ── */}
        {videoUrl && (
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <h2 className="text-base font-semibold">Result</h2>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              style={{
                maxHeight: selectedSkill.aspectRatio === '9:16' ? '70vh' : '50vh',
                objectFit: 'contain',
              }}
            />
            <a
              href={videoUrl}
              download="generated-video.mp4"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-white"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download MP4
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
