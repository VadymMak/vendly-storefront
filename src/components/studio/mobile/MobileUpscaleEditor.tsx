'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MobileMediaPicker } from './MobileMediaPicker';
import { BeforeAfterSlider } from '@/components/studio/editors/shared/BeforeAfterSlider';
import { CREDIT_COSTS } from '@/lib/constants';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';
import { downloadImage, fileFromUrl, shareImage } from '@/lib/studio/mobile/share';

type Step = 'pick' | 'ready' | 'processing' | 'result';

// /api/enhance-image 'upscale' type always scales 4×
const UPSCALE_FACTOR = 4;

export function MobileUpscaleEditor() {
  const t = useTranslations('mobile.upscaleEditor');
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function handleUpscale() {
    if (!sourceUrl) return;
    setStep('processing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', await fileFromUrl(sourceUrl, 'photo'));
      fd.append('type', 'upscale');
      const res = await fetch('/api/enhance-image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string; needsUpgrade?: boolean };
      if (!res.ok || !data.url) {
        setError(data.needsUpgrade || res.status === 402 ? t('noCredits') : t('failed'));
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
    setSize(null);
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
            <img
              src={sourceUrl}
              alt=""
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="max-h-[320px] max-w-full rounded-xl object-contain"
            />
          </div>
          {size && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
              <p className="text-gray-400">{t('current', { w: size.w, h: size.h })}</p>
              <p className="mt-1 font-semibold text-green-400">
                {t('target', { w: size.w * UPSCALE_FACTOR, h: size.h * UPSCALE_FACTOR })}
              </p>
            </div>
          )}
        </div>
        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
          <div className="mx-auto max-w-lg">
            <button
              onClick={handleUpscale}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
            >
              🔍 {t('action', { count: CREDIT_COSTS.upscale })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && sourceUrl && resultUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {header(t('result'))}
        <div className="px-4">
          <BeforeAfterSlider
            beforeUrl={sourceUrl}
            afterUrl={resultUrl}
            beforeLabel={t('original')}
            afterLabel={t('upscaled')}
          />
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
