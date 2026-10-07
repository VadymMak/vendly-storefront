'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { readReelPhotos } from '@/lib/studio/mobile/reel';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'rendering' | 'done' | 'error';
  step: string | null;
  progress: number;
  mode: string;
  cost: number;
  result?: {
    videoUrl: string;
    duration: number;
    totalCost: number;
    shotCount: number;
  };
  error?: string;
}

const STEP_KEY_MAP: Record<string, string> = {
  download: 'stepDownload',
  analyze:  'stepAnalyze',
  outpaint: 'stepOutpaint',
  crops:    'stepCrops',
  scoring:  'stepScoring',
  select:   'stepSelect',
  video:    'stepVideo',
  render:   'stepRender',
  assemble: 'stepAssemble',
  finalize: 'stepFinalize',
};

export function ReelGenerating() {
  const t = useTranslations('mobile.reel');
  const router = useRouter();
  const [phase, setPhase] = useState<'starting' | 'generating' | 'done' | 'error'>('starting');
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGeneration = useCallback(async () => {
    try {
      const photos = readReelPhotos();
      let mode = 'images';
      try { mode = sessionStorage.getItem('reel-mode') ?? 'images'; } catch {}

      if (photos.length === 0) {
        setErrorMsg('No photos selected');
        setPhase('error');
        return;
      }

      const res = await fetch('/api/reel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photos.map(p => ({ url: p.url, originalUrl: p.originalUrl })),
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Failed to start generation');
        setPhase('error');
        return;
      }

      setPhase('generating');

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/reel/generate?jobId=${data.jobId}`);
          const poll: JobStatus = await pollRes.json();
          setJobStatus(poll);
          if (poll.status === 'done') {
            clearInterval(pollRef.current!);
            setPhase('done');
          } else if (poll.status === 'error') {
            clearInterval(pollRef.current!);
            setErrorMsg(poll.error ?? 'Generation failed');
            setPhase('error');
          }
        } catch {
          // network glitch — keep polling
        }
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    startGeneration();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [startGeneration]);

  // ── Starting ──────────────────────────────────────────────────────────
  if (phase === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center py-24" role="status" aria-live="polite">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
        <p className="text-lg font-medium text-white">{t('generating')}</p>
      </div>
    );
  }

  // ── Generating ────────────────────────────────────────────────────────
  if (phase === 'generating') {
    const progress = jobStatus?.progress ?? 0;
    const stepKey = jobStatus?.step ? (STEP_KEY_MAP[jobStatus.step] ?? '') : '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stepLabel = stepKey ? t(stepKey as any) : t('generating');
    const timeEst = jobStatus?.mode === 'video' ? t('timeEstVideo') : t('timeEstImages');
    const circumference = 2 * Math.PI * 48;

    return (
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center" role="status" aria-live="polite">
        <div className="relative mb-6 h-28 w-28">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
            <circle cx="56" cy="56" r="48" strokeWidth="8" fill="none" className="stroke-white/10" />
            <circle
              cx="56" cy="56" r="48" strokeWidth="8" fill="none"
              className="stroke-green-500 transition-all duration-500"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-white">{progress}%</span>
          </div>
        </div>
        <p className="mb-1 text-lg font-medium text-white">{stepLabel}</p>
        <p className="text-sm text-gray-400">{timeEst}</p>
        {(jobStatus?.cost ?? 0) > 0 && (
          <p className="mt-4 text-xs text-gray-500">{t('reelCost', { cost: `$${(jobStatus!.cost).toFixed(2)}` })}</p>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────
  if (phase === 'done' && jobStatus?.result) {
    const { videoUrl, duration, totalCost, shotCount } = jobStatus.result;
    return (
      <div className="flex flex-col items-center px-4 pb-8 pt-10" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <h2 className="mb-4 text-xl font-bold text-white">{t('reelReady')}</h2>
        <div className="mb-4 w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full"
            style={{ aspectRatio: '9/16', objectFit: 'cover' }}
          />
        </div>
        <p className="mb-6 text-sm text-gray-400">
          {duration.toFixed(1)}s · {shotCount} shots · ${totalCost.toFixed(2)}
        </p>
        <div className="w-full max-w-sm space-y-3">
          <a
            href={`${videoUrl}?download=1`}
            download="reel.mp4"
            className="flex min-h-11 items-center justify-center rounded-xl bg-green-600 text-base font-semibold text-white active:bg-green-700"
          >
            {t('downloadReel')}
          </a>
          <button
            onClick={() => router.push('/studio/m/library')}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-white/10 text-sm font-medium text-white active:bg-white/20"
          >
            {t('backToLibrary')}
          </button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <span className="mb-4 text-4xl" aria-hidden="true">⚠️</span>
      <h2 className="mb-2 text-xl font-bold text-white">Chyba</h2>
      <p className="mb-6 max-w-sm text-sm text-gray-400">{errorMsg}</p>
      <button
        onClick={() => router.back()}
        className="flex min-h-11 items-center rounded-xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
      >
        {t('back')}
      </button>
    </div>
  );
}
