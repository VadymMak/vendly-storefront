'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PLATFORM_IMAGE_PRESETS, STYLE_CHIPS } from '@/lib/studio/constants';
import type { GenerationMode } from '@/lib/types';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';

interface GenerateParams {
  prompt: string;
  presetId: string;
  styleId: string;
  referenceImageUrl?: string;
}

interface GenerateResult {
  imageUrl: string;
  jobId?: string;
  model?: string;
  prompt?: string;
  generationMode?: GenerationMode;
}

interface Props {
  generateParams: GenerateParams;
  onComplete: (result: GenerateResult) => void;
  onError: (error: string) => void;
}

export function GeneratingStep({ generateParams, onComplete, onError }: Props) {
  const t = useTranslations('mobile.generating');

  const PHASES = [
    { ms: 0,     label: t('phase1') },
    { ms: 2000,  label: t('phase2') },
    { ms: 5000,  label: t('phase3') },
    { ms: 10000, label: t('phase4') },
    { ms: 20000, label: t('phase5') },
  ];

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const started = useRef(false);

  const preset = PLATFORM_IMAGE_PRESETS.find((p) => p.id === generateParams.presetId);
  const styleChip = STYLE_CHIPS.find((s) => s.id === generateParams.styleId);

  // Phase timer
  useEffect(() => {
    const timers = PHASES.slice(1).map(({ ms }, i) =>
      setTimeout(() => setPhaseIndex(i + 1), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Progress animation (0 → 90 over 20s, then holds)
  useEffect(() => {
    let v = 0;
    const interval = setInterval(() => {
      v = Math.min(v + 0.7, 90);
      setProgress(v);
    }, 140);
    return () => clearInterval(interval);
  }, []);

  // API call
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function generate() {
      const styledPrompt = styleChip?.promptPrefix
        ? `${styleChip.promptPrefix} ${generateParams.prompt}`
        : generateParams.prompt;

      try {
        const res = await fetch('/api/studio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: styledPrompt,
            tier: 'fast',
            aspect_ratio: preset?.aspect_ratio ?? '1:1',
            // Without target dims the server returns the model's raw size (and skips the
            // cover-crop of Kontext output), so the preset ratio would not be enforced.
            ...(preset && { target_width: preset.target_width, target_height: preset.target_height }),
            output_format: 'webp',
            ...(generateParams.referenceImageUrl && {
              reference_image: generateParams.referenceImageUrl,
              style_id: generateParams.styleId, // routes to img2img so the photo is kept
            }),
          }),
        });

        if (!res.ok) {
          let errText = t('failed');
          try {
            const j = await res.json() as { error?: string; needsUpgrade?: boolean; code?: string };
            if (j.needsUpgrade) errText = t('noCredits');
            else if (j.code === 'transform_failed') errText = t('transformFailed');
            else if (j.error) errText = j.error;
          } catch {}
          setErrorMsg(errText);
          onError(errText);
          return;
        }

        const blob = await res.blob();
        const imageUrl = URL.createObjectURL(blob);
        const generationMode: GenerationMode =
          res.headers.get('X-Generation-Mode') === 'photo_transform' ? 'photo_transform' : 'text_create';
        setProgress(100);

        setTimeout(() => {
          notifyCreditsChanged();
          onComplete({ imageUrl, prompt: styledPrompt, model: 'fast', generationMode });
        }, 300);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('failed');
        setErrorMsg(msg);
        onError(msg);
      }
    }

    void generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aspect ratio for skeleton preview
  const [ratioW, ratioH] = (preset?.aspect_ratio ?? '1:1').split(':').map(Number);
  const skeletonH = Math.round((160 * ratioH) / ratioW);

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-8 py-20 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-base font-semibold text-white">{t('failed')}</p>
        <p className="text-sm text-gray-400">{errorMsg}</p>
        <button
          onClick={() => onError(errorMsg)}
          className="mt-4 rounded-full border border-white/10 px-6 py-2.5 text-sm text-gray-300"
        >
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-10">
      {/* Skeleton preview */}
      <div
        className="relative w-40 overflow-hidden rounded-2xl bg-white/[0.06]"
        style={{ height: skeletonH }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex gap-1 text-white/20">
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0s' }}>✨</span>
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0.4s' }}>✨</span>
            <span style={{ animation: 'float 2s ease-in-out infinite', animationDelay: '0.8s' }}>✨</span>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          {t('creating', { preset: preset?.label ?? '' })}
        </p>
        <p className="mt-1.5 text-xs text-gray-500">{PHASES[phaseIndex].label}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs text-gray-600">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
