'use client';

import { useState, useEffect } from 'react';
import type { EditorStatus } from '@/lib/types';
import { EditorShell } from './shared/EditorShell';
import {
  VIDEO_STYLE_CHIPS, VIDEO_DURATIONS, VIDEO_ASPECT_RATIOS,
  type VideoStyleChipId, type VideoDurationValue, type VideoAspectRatio,
} from '@/lib/studio/constants';
import type { VideoQualityTier } from '@/lib/video/resolve-route';

const PREMIUM_STYLES: VideoStyleChipId[] = ['product', 'food', 'beauty', 'space', 'service', 'hospitality', 'fashion'];

interface GenerateVideoEditorProps {
  onAccept: (videoUrl: string, prompt: string) => void;
  onClose:  () => void;
  hasVideoCredits: boolean;
  onNeedCredits:   () => void;
}

async function pollJob(jobId: string, timeoutMs = 600_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const res  = await fetch(`/api/studio/job/${jobId}`);
    const data = await res.json() as { status: string; outputUrl?: string; error?: string };
    if (data.status === 'succeeded' && data.outputUrl) return data.outputUrl;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error ?? `Job ${data.status}`);
    }
  }
  throw new Error('Video generation timed out');
}

export function GenerateVideoEditor({
  onAccept, onClose, hasVideoCredits, onNeedCredits,
}: GenerateVideoEditorProps) {
  const [prompt,      setPrompt]      = useState('');
  const [style,       setStyle]       = useState<VideoStyleChipId>('product');
  const [quality,     setQuality]     = useState<VideoQualityTier>('best');
  const [duration,    setDuration]    = useState<VideoDurationValue>(10);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [status,      setStatus]      = useState<EditorStatus>('configuring');
  const [resultUrl,   setResultUrl]   = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // Auto-set default quality when style changes
  useEffect(() => {
    const chip = VIDEO_STYLE_CHIPS.find(s => s.id === style);
    if (chip?.defaultQuality) setQuality(chip.defaultQuality);
  }, [style]);

  const durObj    = VIDEO_DURATIONS.find(d => d.seconds === duration);
  const creditCost = quality === 'best'
    ? (durObj?.bestCredits  ?? 10)
    : (durObj?.quickCredits ?? 4);

  async function handleGenerate() {
    if (!hasVideoCredits) { onNeedCredits(); return; }
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const styleChip  = VIDEO_STYLE_CHIPS.find(s => s.id === style);
    const suffix     = quality === 'best' && styleChip?.bestPromptSuffix
      ? styleChip.bestPromptSuffix
      : (styleChip?.promptSuffix ?? '');
    const finalPrompt = suffix ? `${trimmed}, ${suffix}` : trimmed;

    setStatus('processing');
    setError(null);

    try {
      const res = await fetch('/api/studio/generate-video-t2v', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: finalPrompt, duration, aspectRatio, style, quality }),
      });

      const data = await res.json() as { jobId?: string; error?: string; needsUpgrade?: boolean };
      if (!res.ok) {
        if (data.needsUpgrade) { onNeedCredits(); setStatus('configuring'); return; }
        throw new Error(data.error ?? 'Failed to start video generation');
      }

      const videoUrl = await pollJob(data.jobId!);
      setResultUrl(videoUrl);
      setStatus('result-ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setStatus('error');
    }
  }

  const sidebar = (
    <div className="flex flex-col gap-5">
      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-400">Describe your video</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="A scenic mountain landscape with flowing river..."
          rows={4}
          disabled={status === 'processing'}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none focus:border-green-500/40 transition-colors disabled:opacity-50"
        />
      </div>

      {/* Style chips */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-400">Style</span>
        <div className="flex flex-wrap gap-1.5">
          {VIDEO_STYLE_CHIPS.map(chip => (
            <button
              key={chip.id}
              disabled={status === 'processing'}
              onClick={() => setStyle(chip.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                style === chip.id
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="mr-1">{chip.icon}</span>{chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality toggle */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-400">Quality</span>
        <div className="flex gap-2">
          <button
            disabled={status === 'processing'}
            onClick={() => setQuality('quick')}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all disabled:opacity-50 ${
              quality === 'quick'
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <span className={`text-xs font-medium ${quality === 'quick' ? 'text-green-400' : 'text-white'}`}>
              ⚡ Quick
            </span>
            <span className="text-[10px] text-gray-500">Fast, social-ready</span>
          </button>
          <button
            disabled={status === 'processing'}
            onClick={() => setQuality('best')}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all disabled:opacity-50 ${
              quality === 'best'
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <span className={`text-xs font-medium ${quality === 'best' ? 'text-green-400' : 'text-white'}`}>
              ✨ Best quality
            </span>
            <span className="text-[10px] text-gray-500">Cinematic, commercial</span>
          </button>
        </div>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-400">Duration</span>
        <div className="flex gap-2">
          {VIDEO_DURATIONS.map(d => {
            const dCredits = quality === 'best' ? d.bestCredits : d.quickCredits;
            return (
              <button
                key={d.seconds}
                disabled={status === 'processing'}
                onClick={() => setDuration(d.seconds)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all disabled:opacity-50 ${
                  duration === d.seconds
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <span className={`block text-xs font-medium ${duration === d.seconds ? 'text-green-400' : 'text-white'}`}>
                  {d.label}
                </span>
                <span className="text-[10px] text-gray-500 opacity-60">{dCredits} cr · {d.eta}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aspect ratio */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-400">Aspect Ratio</span>
        <div className="flex gap-2">
          {VIDEO_ASPECT_RATIOS.map(ar => (
            <button
              key={ar.value}
              disabled={status === 'processing'}
              onClick={() => setAspectRatio(ar.value)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all disabled:opacity-50 ${
                aspectRatio === ar.value
                  ? 'border-green-500/40 bg-green-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <span className={`text-xs font-semibold ${aspectRatio === ar.value ? 'text-green-400' : 'text-white'}`}>
                {ar.label}
              </span>
              <span className="text-[10px] text-gray-500">{ar.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <EditorShell
      title="Generate Video"
      creditCost={creditCost}
      status={status}
      onBack={onClose}
      error={error ?? undefined}
      primaryAction={status !== 'result-ready' ? {
        label:    status === 'processing' ? 'Generating…' : `Generate ${quality === 'best' ? '✨ Best' : '⚡ Quick'} · ${creditCost} cr`,
        loading:  status === 'processing',
        disabled: !prompt.trim() || status === 'processing',
        onClick:  () => void handleGenerate(),
      } : {
        label:   'Accept & Save',
        onClick: () => { if (resultUrl) onAccept(resultUrl, prompt.trim()); },
      }}
      secondaryAction={status === 'result-ready' ? {
        label:   'Generate Again',
        onClick: () => { setResultUrl(null); setStatus('configuring'); },
      } : undefined}
      sidebar={sidebar}
    >
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0f] p-6">
        {status === 'configuring' || status === 'error' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400" aria-hidden="true">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Text-to-Video</p>
              <p className="mt-1 text-xs text-gray-500">
                Describe your video in the panel → hit Generate
              </p>
            </div>
          </div>
        ) : status === 'processing' ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 animate-pulse" aria-hidden="true">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Generating your video…</p>
              <p className="mt-1 text-xs text-gray-500">
                {quality === 'best' ? 'Best quality takes 60–120 seconds' : 'This may take 30–60 seconds'}
              </p>
            </div>
            <p className="max-w-xs text-xs text-gray-400 line-clamp-2">&ldquo;{prompt}&rdquo;</p>
          </div>
        ) : resultUrl ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-xl">
            <video
              src={resultUrl}
              controls
              autoPlay
              loop
              playsInline
              className="w-full max-h-[70vh] rounded-xl border border-white/10 bg-black object-contain"
            />
            <button
              onClick={async () => {
                try {
                  const res = await fetch(resultUrl);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `studio-video-${Date.now()}.mp4`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  window.open(resultUrl, '_blank');
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>

            {/* Upgrade CTA: Quick result on premium style */}
            {quality === 'quick' && PREMIUM_STYLES.includes(style) && (
              <button
                onClick={() => {
                  setQuality('best');
                  setResultUrl(null);
                  setStatus('configuring');
                }}
                className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                <span>✨</span>
                <span>
                  Create Best-quality version · {VIDEO_DURATIONS.find(d => d.seconds === duration)?.bestCredits ?? 10} cr
                </span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </EditorShell>
  );
}
