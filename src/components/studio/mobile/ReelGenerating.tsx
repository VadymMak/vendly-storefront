'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { readReelPhotos } from '@/lib/studio/mobile/reel';
import type { MusicTrack } from '@/lib/types';
import MusicBottomSheet from './MusicBottomSheet';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'rendering' | 'done' | 'error';
  step: string | null;
  progress: number;
  mode: string;
  cost: number;
  currentTrackId?: string;
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
  const [jobId, setJobId] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Music state
  const [currentTrackId, setCurrentTrackId] = useState<string>('warm-cafe');
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [isRemuxing, setIsRemuxing] = useState(false);
  const [audioPreviewId, setAudioPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch music catalog on mount
  useEffect(() => {
    fetch('/api/reel/music')
      .then(r => r.json())
      .then(data => setMusicTracks(data.tracks || []))
      .catch(() => {});
  }, []);

  const startGeneration = useCallback(async () => {
    try {
      const photos = readReelPhotos();
      let mode = 'images';
      let cta1 = '';
      let cta2 = '';
      let musicTrackId = 'warm-cafe';
      try {
        mode = sessionStorage.getItem('reel-mode') ?? 'images';
        cta1 = sessionStorage.getItem('reel-cta1') ?? '';
        cta2 = sessionStorage.getItem('reel-cta2') ?? '';
        musicTrackId = sessionStorage.getItem('reel-musicTrackId') ?? 'warm-cafe';
      } catch {}

      setCurrentTrackId(musicTrackId);

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
          cta1,
          cta2,
          musicTrackId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Failed to start generation');
        setPhase('error');
        return;
      }

      setJobId(data.jobId);
      setPhase('generating');

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/reel/generate?jobId=${data.jobId}`);
          const poll: JobStatus = await pollRes.json();
          setJobStatus(poll);
          if (poll.status === 'done') {
            clearInterval(pollRef.current!);
            if (poll.currentTrackId) setCurrentTrackId(poll.currentTrackId);
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

  const handleMusicChange = async (trackId: string) => {
    if (trackId === currentTrackId) {
      setShowMusicSheet(false);
      return;
    }

    setIsRemuxing(true);
    setShowMusicSheet(false);

    try {
      const res = await fetch('/api/reel/remux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, musicTrackId: trackId }),
      });

      const data = await res.json();
      if (data.success && data.videoUrl) {
        setJobStatus(prev => prev ? {
          ...prev,
          result: prev.result ? { ...prev.result, videoUrl: data.videoUrl } : prev.result,
        } : prev);
        setCurrentTrackId(trackId);
        try { localStorage.setItem('reel-preferred-music', trackId); } catch {}
      }
    } catch (err) {
      console.error('Re-mux failed:', err);
    } finally {
      setIsRemuxing(false);
    }
  };

  const handlePreview = (track: MusicTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPreviewId === track.id) {
      audio.pause();
      audio.currentTime = 0;
      setAudioPreviewId(null);
      return;
    }

    audio.pause();
    audio.src = `/api/reel/music/preview?id=${encodeURIComponent(track.id)}`;
    audio.load();
    audio.play().catch((err) => { console.warn('Audio preview failed:', err); });
    setAudioPreviewId(track.id);

    audio.onended = () => setAudioPreviewId(null);
  };

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
    const currentTrack = musicTracks.find(t => t.id === currentTrackId);

    return (
      <div className="flex flex-col pb-8 pt-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <h2 className="mb-4 px-4 text-xl font-bold text-white">{t('reelReady')}</h2>

        {/* Video player */}
        <div className="mx-4 overflow-hidden rounded-2xl bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full"
            style={{ aspectRatio: '9/16', objectFit: 'cover' }}
          />
        </div>

        {/* Stats */}
        <p className="mt-3 px-4 text-sm text-gray-400">
          {duration.toFixed(1)}s · {shotCount} shots · ${totalCost.toFixed(2)}
        </p>

        {/* Music section */}
        <div className="mx-4 mt-4">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {currentTrackId === 'no-music' ? '🔇' : currentTrack?.emoji ?? '🎵'}
              </span>
              <span className="text-white text-sm">
                {currentTrackId === 'no-music' ? t('noMusic') : currentTrack?.title ?? 'Warm Café'}
              </span>
            </div>

            <button
              onClick={() => setShowMusicSheet(true)}
              disabled={isRemuxing}
              className="flex items-center gap-1.5 text-xs text-green-400 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {isRemuxing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('applying')}
                </>
              ) : (
                t('musicChange')
              )}
            </button>
          </div>
          <audio ref={audioRef} className="hidden" />
        </div>

        {/* Action buttons */}
        <div className="mx-4 mt-4 space-y-3">
          <a
            href={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}download=1`}
            download="reel.mp4"
            className="flex min-h-11 items-center justify-center rounded-xl bg-green-600 text-base font-semibold text-white active:bg-green-700"
          >
            {t('downloadReel')}
          </a>

          <button
            onClick={() => {
              try { sessionStorage.removeItem('reel-photos'); } catch {}
              router.push('/studio/m/library?mode=reel-select');
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-white/5 text-sm font-medium text-white border border-white/10 active:bg-white/10"
          >
            {t('createAnother')}
          </button>

          <button
            onClick={() => router.push('/studio/m/library')}
            className="flex w-full items-center justify-center py-2.5 text-sm text-gray-400"
          >
            {t('backToLibrary')}
          </button>
        </div>

        {/* Music bottom sheet */}
        {showMusicSheet && (
          <MusicBottomSheet
            tracks={musicTracks}
            currentTrackId={currentTrackId}
            previewingId={audioPreviewId}
            onSelect={handleMusicChange}
            onPreview={handlePreview}
            onClose={() => setShowMusicSheet(false)}
          />
        )}
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
