'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MobileMediaPicker } from './MobileMediaPicker';
import { CREDIT_COSTS } from '@/lib/constants';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';
import { downloadImage, fileFromUrl, shareImage } from '@/lib/studio/mobile/share';

type Step = 'pick' | 'ready' | 'processing' | 'result';
type PreviewBg = 'checker' | 'white' | 'black';

const CHECKER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg,#2a2a33 25%,transparent 25%),linear-gradient(-45deg,#2a2a33 25%,transparent 25%),' +
    'linear-gradient(45deg,transparent 75%,#2a2a33 75%),linear-gradient(-45deg,transparent 75%,#2a2a33 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
  backgroundColor: '#1c1c22',
};

const PREVIEW_BG: Record<PreviewBg, React.CSSProperties> = {
  checker: CHECKER,
  white:   { background: '#ffffff' },
  black:   { background: '#000000' },
};

export function MobileRemoveBgEditor() {
  const t = useTranslations('mobile.removeBgEditor');
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState<PreviewBg>('checker');
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function handleRemove() {
    if (!sourceUrl) return;
    setStep('processing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', await fileFromUrl(sourceUrl, 'photo'));
      const res = await fetch('/api/studio/remove-bg', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(res.status === 402 || res.status === 403 ? t('noCredits') : t('failed'));
        setStep('ready');
        return;
      }
      notifyCreditsChanged();
      setResultUrl(data.url);
      setStep('result');
    } catch {
      setError(t('failed'));
      setStep('ready');
    }
  }

  async function handleShare() {
    if (!resultUrl) return;
    setSharing(true);
    await shareImage(resultUrl, t('shareTitle'));
    setSharing(false);
  }

  function startOver() {
    setSourceUrl(null);
    setResultUrl(null);
    setError(null);
    setStep('pick');
  }

  function handleBack() {
    if (step === 'result') setStep('ready');
    else if (step === 'ready') startOver();
    else router.push('/studio/m');
  }

  const header = (title: string) => (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <button
        onClick={handleBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
        aria-label={t('back')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="text-base font-semibold text-white">{title}</span>
    </div>
  );

  if (step === 'pick') {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('title'))}
        <div className="px-4">
          <p className="mb-4 text-sm text-gray-400">{t('subtitle')}</p>
          <MobileMediaPicker
            onImageSelected={(url) => { setSourceUrl(url); setStep('ready'); }}
            currentImage={undefined}
            onClear={() => {}}
          />
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
        <p className="text-sm text-gray-300">{t('processing')}</p>
        <p className="text-xs text-gray-500">{t('processingHint')}</p>
      </div>
    );
  }

  if (step === 'ready' && sourceUrl) {
    return (
      <div className="flex flex-col pb-40" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('title'))}
        <div className="px-4">
          <div className="flex justify-center rounded-xl bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sourceUrl} alt="" className="max-h-[360px] max-w-full rounded-xl object-contain" />
          </div>
        </div>
        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
          <div className="mx-auto max-w-lg">
            <button
              onClick={handleRemove}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
            >
              ✂️ {t('action', { count: CREDIT_COSTS.removeBg })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && resultUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('result'))}
        <div className="px-4">
          <div className="flex justify-center rounded-xl" style={PREVIEW_BG[previewBg]}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="" className="max-h-[380px] max-w-full object-contain" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-xs text-gray-500">{t('bgLabel')}</span>
            {(Object.keys(PREVIEW_BG) as PreviewBg[]).map((bg) => (
              <button
                key={bg}
                onClick={() => setPreviewBg(bg)}
                aria-label={bg}
                aria-pressed={previewBg === bg}
                className={`h-7 w-7 rounded-full border-2 ${previewBg === bg ? 'border-green-500' : 'border-white/20'}`}
                style={PREVIEW_BG[bg]}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => downloadImage(resultUrl)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            💾 {t('save')}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            📤 {t('share')}
          </button>
        </div>

        <div className="mt-3 space-y-2 px-4">
          <button
            onClick={() => router.push(`/studio/m/place-products?cutout=${encodeURIComponent(resultUrl)}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 py-3.5 text-sm font-semibold text-green-300 active:bg-green-500/20"
          >
            ✨ {t('placeOnBackground')}
          </button>
          <button
            onClick={() => router.push(`/studio/m/create?ref=${encodeURIComponent(resultUrl)}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            🎨 {t('usePromo')}
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <button onClick={startOver} className="text-sm text-gray-400 active:text-white">
            ↩ {t('newPhoto')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
