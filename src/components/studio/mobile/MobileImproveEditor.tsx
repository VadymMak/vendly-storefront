'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ENHANCEMENT_PRESETS } from '@/lib/studio/constants';
import type { EnhancementIntensity } from '@/lib/types';
import { MobileMediaPicker } from './MobileMediaPicker';
import { BeforeAfterSlider } from '@/components/studio/editors/shared/BeforeAfterSlider';
import { downloadImage, extFromMime, proxyUrl, saveBlob } from '@/lib/studio/mobile/share';

type ImproveStep = 'upload' | 'configure' | 'processing' | 'result' | 'ai-processing' | 'ai-result';

const INTENSITIES: EnhancementIntensity[] = ['natural', 'professional', 'bold'];

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
  );
}

export function MobileImproveEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('mobile.improve');

  const [step, setStep] = useState<ImproveStep>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('professional');
  const [intensity, setIntensity] = useState<EnhancementIntensity>('professional');
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [aiFinishUrl, setAiFinishUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const fromSearchParams = useRef(false);

  useEffect(() => {
    const img = searchParams.get('image');
    if (img) {
      setImageUrl(decodeURIComponent(img));
      setStep('configure');
      fromSearchParams.current = true;
    }
  }, [searchParams]);

  // Prefetch final result blob for instant share
  const finalUrl = step === 'ai-result' ? aiFinishUrl : enhancedUrl;
  useEffect(() => {
    if (!finalUrl) return;
    blobRef.current = null;
    fetch(finalUrl)
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) blobRef.current = b; })
      .catch(() => {});
  }, [finalUrl]);

  async function handleEnhance() {
    if (!imageUrl) return;
    setStep('processing');
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
        const data = await apiRes.json() as { error?: string };
        throw new Error(data.error ?? 'Enhancement failed');
      }
      const data = await apiRes.json() as { url: string };
      setEnhancedUrl(data.url);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setStep('configure');
    }
  }

  async function handleAiStyle() {
    if (!imageUrl || !enhancedUrl) return;
    setStep('ai-processing');
    setError(null);
    try {
      const preset = ENHANCEMENT_PRESETS.find(p => p.id === selectedPreset);
      if (!preset) throw new Error('Preset not found');

      // Get original dimensions
      const img = new Image();
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });
      const { naturalWidth: originalWidth, naturalHeight: originalHeight } = img;

      // Fetch enhanced image
      const enhancedRes = await fetch(enhancedUrl);
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
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'AI Style failed');
      }
      const data = await res.json() as { url: string };

      // Resize back to original dimensions
      const resizeRes = await fetch('/api/studio/resize-to-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultUrl: data.url, originalWidth, originalHeight }),
      });
      if (resizeRes.ok) {
        const resizeData = await resizeRes.json() as { url: string };
        setAiFinishUrl(resizeData.url);
      } else {
        setAiFinishUrl(data.url);
      }

      setStep('ai-result');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
      setStep('result');
    }
  }

  async function handleShare(url: string) {
    setSharing(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(url);
        if (res.ok) blob = await res.blob();
      }
      if (blob) {
        const file = new File([blob], `enhanced.${extFromMime(blob.type)}`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: t('shareTitle'), files: [file] });
          setSharing(false);
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setSharing(false); return; }
    }
    await downloadImage(url);
    setSharing(false);
  }

  function handleSave(url: string) {
    if (blobRef.current) {
      saveBlob(blobRef.current);
      return;
    }
    downloadImage(url);
  }

  function handleBack() {
    if (step === 'configure' && fromSearchParams.current) {
      router.back();
    } else if (step === 'configure') {
      setStep('upload');
    } else if (step === 'result') {
      setStep('configure');
    } else if (step === 'ai-result') {
      setStep('result');
    }
  }

  // ── Step: upload ────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="px-4 pt-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <h2 className="text-lg font-semibold text-white mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-400 mb-4">{t('subtitle')}</p>
        <MobileMediaPicker
          onImageSelected={(url) => { setImageUrl(url); setStep('configure'); }}
          currentImage={undefined}
          onClear={() => {}}
        />
      </div>
    );
  }

  // ── Step: processing ────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <Spinner />
        <p className="text-sm text-gray-300">{t('enhancing')}</p>
        <p className="text-xs text-gray-500">{t('enhancingHint')}</p>
      </div>
    );
  }

  // ── Step: ai-processing ─────────────────────────────────────────────────────
  if (step === 'ai-processing') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <Spinner />
        <p className="text-sm text-gray-300">{t('applyingAi')}</p>
        <p className="text-xs text-gray-500">{t('applyingAiHint')}</p>
      </div>
    );
  }

  // ── Step: configure ─────────────────────────────────────────────────────────
  if (step === 'configure') {
    return (
      <div className="flex flex-col pb-28" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {/* Header */}
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
          <span className="text-base font-semibold text-white">{t('title')}</span>
        </div>

        {/* Photo preview */}
        {imageUrl && (
          <div className="px-4 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Selected photo" className="w-full max-h-[200px] rounded-xl object-cover" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Intensity */}
        <div className="px-4 pb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('intensity')}</p>
          <div className="flex gap-2">
            {INTENSITIES.map((lvl) => {
              const labelKey = lvl as 'natural' | 'professional' | 'bold';
              return (
                <button
                  key={lvl}
                  onClick={() => setIntensity(lvl)}
                  className={`flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                    intensity === lvl
                      ? 'bg-green-600 text-white'
                      : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
                  }`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Style */}
        <div className="px-4 pb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('style')}</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {ENHANCEMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                className={`w-[120px] shrink-0 rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.97] ${
                  selectedPreset === preset.id
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <p className="text-xs font-semibold text-white leading-tight">{preset.label}</p>
                <p className="mt-0.5 text-[10px] text-gray-500 leading-tight">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Fixed CTA */}
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-0 right-0 z-40 px-4">
          <div className="mx-auto max-w-lg">
            <button
              onClick={handleEnhance}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
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

  // ── Step: result ────────────────────────────────────────────────────────────
  if (step === 'result' && imageUrl && enhancedUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
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
          <span className="text-base font-semibold text-white">{t('enhanced')}</span>
          <div className="w-9" />
        </div>

        <div className="px-4">
          <BeforeAfterSlider
            beforeUrl={imageUrl}
            afterUrl={enhancedUrl}
            beforeLabel={t('original')}
            afterLabel={t('enhanced')}
          />
        </div>

        {/* Success info */}
        <div className="mx-4 mt-4 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-green-400">✓ {t('photoEnhanced')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('photoEnhancedDesc')}</p>
        </div>

        {/* Save + Share */}
        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => handleSave(enhancedUrl)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            💾 {t('save')}
          </button>
          <button
            onClick={() => handleShare(enhancedUrl)}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            📤 {t('share')}
          </button>
        </div>

        {/* AI Style */}
        <div className="mx-4 mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-4">
          <p className="text-sm font-semibold text-white">{t('wantMore')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('wantMoreDesc')}</p>
          <button
            onClick={handleAiStyle}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600/80 py-3 text-sm font-semibold text-white active:bg-purple-700"
          >
            ✨ {t('applyAiStyle')}
          </button>
        </div>

        {/* Bottom actions */}
        {error && <p className="mt-3 px-4 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex items-center justify-center gap-6 px-4 pb-2">
          <button onClick={() => setStep('configure')} className="text-sm text-gray-400 active:text-white">
            🔄 {t('tryAnother')}
          </button>
          <button onClick={() => { setStep('upload'); fromSearchParams.current = false; }} className="text-sm text-gray-400 active:text-white">
            ↩ {t('newPhoto')}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: ai-result ─────────────────────────────────────────────────────────
  if (step === 'ai-result' && enhancedUrl && aiFinishUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
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
          <span className="text-base font-semibold text-white">{t('aiStyle')}</span>
          <div className="w-9" />
        </div>

        <div className="px-4">
          <BeforeAfterSlider
            beforeUrl={enhancedUrl}
            afterUrl={aiFinishUrl}
            beforeLabel={t('enhanced')}
            afterLabel={t('aiStyle')}
          />
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-purple-300">✨ {t('aiApplied')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('aiAppliedDesc')}</p>
        </div>

        {error && <p className="mt-3 px-4 text-sm text-red-400">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => { blobRef.current = null; setStep('result'); }}
            className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            {t('keepEnhanced')}
          </button>
          <button
            onClick={() => handleSave(aiFinishUrl)}
            className="flex items-center justify-center rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('keepAi')}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => handleSave(aiFinishUrl)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            💾 {t('save')}
          </button>
          <button
            onClick={() => handleShare(aiFinishUrl)}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            📤 {t('share')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
