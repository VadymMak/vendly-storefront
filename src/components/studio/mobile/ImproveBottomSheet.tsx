'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ENHANCEMENT_PRESETS } from '@/lib/studio/constants';
import { proxyUrl } from '@/lib/studio/mobile/share';
import type { EnhancementIntensity } from '@/lib/types';
import { BeforeAfterSlider } from '@/components/studio/editors/shared/BeforeAfterSlider';

interface Props {
  imageUrl: string;
  onDone: (resultUrl: string) => void;
  onCancel: () => void;
}

type ImprovePhase = 'configure' | 'processing' | 'result' | 'ai-processing' | 'ai-result';

const INTENSITIES: EnhancementIntensity[] = ['natural', 'professional', 'bold'];

interface ProcessingViewProps {
  imageUrl: string;
  title: string;
  estimate: string;
  /** Status lines shown in order, each from its start time (ms) */
  phases: { ms: number; label: string }[];
  /** Shown once elapsed passes slowAfterMs */
  slowLabel: string;
  slowAfterMs: number;
  /** Typical duration — the bar reaches ~80% around this point, then creeps toward 95% */
  expectedMs: number;
  accent: 'green' | 'purple';
}

function ProcessingView({ imageUrl, title, estimate, phases, slowLabel, slowAfterMs, expectedMs, accent }: ProcessingViewProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(id);
  }, []);

  const progress = 95 * (1 - Math.exp((-1.6 * elapsed) / expectedMs));
  const label = elapsed >= slowAfterMs
    ? slowLabel
    : [...phases].reverse().find((p) => elapsed >= p.ms)?.label ?? phases[0].label;
  const bar = accent === 'purple' ? 'bg-purple-500' : 'bg-green-500';

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-10" role="status" aria-live="polite" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      <div className="relative w-48 overflow-hidden rounded-2xl bg-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="block w-full opacity-60" />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex gap-1 text-lg text-white/70">
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0s' }}>✨</span>
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0.4s' }}>✨</span>
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0.8s' }}>✨</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-white">{title}</p>
        <p key={label} className="mt-1.5 text-sm text-gray-400" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>{label}</p>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${bar} transition-all duration-300`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-gray-600">
          <span>{estimate}</span>
          <span>{Math.floor(elapsed / 1000)}s</span>
        </div>
      </div>
    </div>
  );
}

function BackHeader({ title, label, onBack }: { title: string; label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <button
        onClick={onBack}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400 active:text-white"
        aria-label={label}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="text-base font-semibold text-white">{title}</span>
    </div>
  );
}

export function ImproveBottomSheet({ imageUrl, onDone, onCancel }: Props) {
  const t = useTranslations('mobile.improveSheet');
  const [phase, setPhase] = useState<ImprovePhase>('configure');
  const [selectedPreset, setSelectedPreset] = useState('professional');
  const [intensity, setIntensity] = useState<EnhancementIntensity>('professional');
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [aiUrl, setAiUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEnhance() {
    setPhase('processing');
    setError(null);
    try {
      const res = await fetch(proxyUrl(imageUrl));
      const blob = await res.blob();
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });

      const fd = new FormData();
      fd.append('image', file);
      fd.append('preset', selectedPreset);
      fd.append('intensity', intensity);

      const apiRes = await fetch('/api/studio/enhance-deterministic', { method: 'POST', body: fd });
      if (!apiRes.ok) {
        const data = await apiRes.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? t('error'));
      }
      const data = await apiRes.json() as { url: string };
      setEnhancedUrl(data.url);
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setPhase('configure');
    }
  }

  async function handleAiStyle() {
    if (!enhancedUrl) return;
    setPhase('ai-processing');
    setError(null);
    try {
      const preset = ENHANCEMENT_PRESETS.find(p => p.id === selectedPreset);
      if (!preset) throw new Error(t('error'));

      // Original dimensions — Grok returns its own size, resized back below
      const img = new Image();
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(t('error')));
      });
      const { naturalWidth: originalWidth, naturalHeight: originalHeight } = img;

      const enhancedRes = await fetch(proxyUrl(enhancedUrl));
      const enhancedBlob = await enhancedRes.blob();
      const enhancedType = enhancedBlob.type || 'image/jpeg';
      const enhancedFile = new File(
        [enhancedBlob],
        enhancedType === 'image/png' ? 'enhanced.png' : 'enhanced.jpg',
        { type: enhancedType },
      );

      const fd = new FormData();
      fd.append('image', enhancedFile);
      fd.append('prompt', preset.aiFinishPrompt);
      fd.append('modelAlias', 'edit-grok');

      const res = await fetch('/api/studio/edit', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? t('error'));
      }
      const data = await res.json() as { url: string };

      const resizeRes = await fetch('/api/studio/resize-to-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultUrl: data.url, originalWidth, originalHeight }),
      });
      if (resizeRes.ok) {
        const resizeData = await resizeRes.json() as { url: string };
        setAiUrl(resizeData.url);
      } else {
        setAiUrl(data.url);
      }
      setPhase('ai-result');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setPhase('result');
    }
  }

  if (phase === 'processing') {
    return (
      <ProcessingView
        imageUrl={imageUrl}
        title={t('enhancing')}
        estimate={t('enhanceEstimate')}
        phases={[
          { ms: 0, label: t('enhancePhase1') },
          { ms: 800, label: t('enhancePhase2') },
          { ms: 1800, label: t('enhancePhase3') },
        ]}
        slowLabel={t('slow')}
        slowAfterMs={8000}
        expectedMs={2000}
        accent="green"
      />
    );
  }

  if (phase === 'ai-processing') {
    return (
      <ProcessingView
        imageUrl={enhancedUrl ?? imageUrl}
        title={t('applyingAi')}
        estimate={t('aiEstimate')}
        phases={[
          { ms: 0, label: t('aiPhase1') },
          { ms: 2000, label: t('aiPhase2') },
          { ms: 5000, label: t('aiPhase3') },
          { ms: 9000, label: t('aiPhase4') },
          { ms: 13000, label: t('aiPhase5') },
        ]}
        slowLabel={t('slow')}
        slowAfterMs={20000}
        expectedMs={10000}
        accent="purple"
      />
    );
  }

  if (phase === 'ai-result' && enhancedUrl && aiUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <BackHeader title={t('aiStyle')} label={t('back')} onBack={() => setPhase('result')} />

        <div className="px-4">
          <BeforeAfterSlider
            beforeUrl={enhancedUrl}
            afterUrl={aiUrl}
            beforeLabel={t('enhanced')}
            afterLabel={t('aiStyle')}
          />
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-purple-300">✨ {t('aiApplied')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('aiAppliedDesc')}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => onDone(enhancedUrl)}
            className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            {t('keepEnhanced')}
          </button>
          <button
            onClick={() => onDone(aiUrl)}
            className="flex min-h-11 items-center justify-center rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('keepAi')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result' && enhancedUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <BackHeader title={t('enhanced')} label={t('back')} onBack={() => setPhase('configure')} />

        <div className="px-4">
          <BeforeAfterSlider
            beforeUrl={imageUrl}
            afterUrl={enhancedUrl}
            beforeLabel={t('original')}
            afterLabel={t('enhanced')}
          />
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-green-400">✓ {t('photoEnhanced')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('photoEnhancedDesc')}</p>
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-4">
          <p className="text-sm font-semibold text-white">{t('wantMore')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('wantMoreDesc')}</p>
          <button
            onClick={handleAiStyle}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600/80 py-3 text-sm font-semibold text-white active:bg-purple-700"
          >
            ✨ {t('applyAiStyle')}
          </button>
        </div>

        {error && <p role="alert" className="mt-3 px-4 text-sm text-red-400">{error}</p>}

        <button
          onClick={() => setPhase('configure')}
          className="mx-auto mt-3 flex min-h-11 items-center px-4 text-sm text-gray-400 active:text-white"
        >
          🔄 {t('tryAnother')}
        </button>

        <div className="mt-2 px-4">
          <button
            onClick={() => onDone(enhancedUrl)}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('useThis')}
          </button>
        </div>
      </div>
    );
  }

  // ── configure ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col pb-28" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      <BackHeader title={t('title')} label={t('back')} onBack={onCancel} />

      <div className="px-4 pb-4">
        <div className="flex justify-center rounded-xl bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="max-h-[240px] max-w-full rounded-xl object-contain" />
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('intensity')}</p>
        <div className="flex gap-2">
          {INTENSITIES.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setIntensity(lvl)}
              aria-pressed={intensity === lvl}
              className={`min-h-11 flex-1 rounded-full text-xs font-semibold transition-colors ${
                intensity === lvl
                  ? 'bg-green-600 text-white'
                  : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
              }`}
            >
              {t(lvl)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('style')}</p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {ENHANCEMENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              aria-pressed={selectedPreset === preset.id}
              className={`w-[120px] shrink-0 rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.97] ${
                selectedPreset === preset.id
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <p className="text-xs font-semibold leading-tight text-white">{preset.label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-gray-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Fixed CTA — sits above the mobile bottom nav */}
      <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-0 z-40 px-4">
        <div className="mx-auto max-w-lg">
          <button
            onClick={handleEnhance}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {t('improve')}
          </button>
        </div>
      </div>
    </div>
  );
}
