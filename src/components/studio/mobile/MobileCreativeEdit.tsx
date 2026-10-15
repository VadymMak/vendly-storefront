'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CreativeAspectRatio } from '@/lib/types';
import { CREATIVE_ASPECT_RATIOS } from '@/lib/studio/constants';
import { CREATIVE_EDIT_CREDITS, requestCreativeEdit } from '@/lib/studio/creative-edit';
import { MobileMediaPicker } from './MobileMediaPicker';
import { MobileVoiceInput } from './MobileVoiceInput';
import { MobileTextOverlayEditor } from './MobileTextOverlayEditor';
import { BeforeAfterSlider } from '@/components/studio/editors/shared/BeforeAfterSlider';
import { TimedProgressBar } from '@/components/studio/editors/shared/TimedProgressBar';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';
import { downloadImage, extFromMime, proxyUrl, saveBlob } from '@/lib/studio/mobile/share';

type CreativeStep = 'upload' | 'configure' | 'processing' | 'result';

// Grok 2k edit: 14 s average, 17.6 s p90 (StudioUsageLog)
const TYPICAL_DURATION_MS = 15_000;

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

export function MobileCreativeEdit() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('creativeEdit');

  const [step, setStep] = useState<CreativeStep>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<CreativeAspectRatio>('auto');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // Ratio the shown result was made with — the slider only lines up when the shape is unchanged
  const [resultRatio, setResultRatio] = useState<CreativeAspectRatio>('auto');
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [compositedImage, setCompositedImage] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const fromSearchParams = useRef(false);

  // Absolute https:/blob: only — relative paths would be fetched same-origin with cookies
  function isAllowedImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'blob:';
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const img = searchParams.get('image');
    if (img && isAllowedImageUrl(img)) {
      setImageUrl(img);
      setStep('configure');
      fromSearchParams.current = true;
    }
  }, [searchParams]);

  // compositedImage is a blob: URL from the text editor — release it when replaced or on unmount
  useEffect(() => {
    if (!compositedImage) return;
    return () => URL.revokeObjectURL(compositedImage);
  }, [compositedImage]);

  const displayUrl = compositedImage ?? resultUrl;

  // Prefetch the result blob so Share opens instantly (navigator.share needs a user gesture)
  useEffect(() => {
    if (!displayUrl) return;
    blobRef.current = null;
    fetch(proxyUrl(displayUrl))
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) blobRef.current = b; })
      .catch(() => {});
  }, [displayUrl]);

  const handleTranscript = useCallback((text: string) => {
    setPrompt((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  function clearText() {
    setCompositedImage(null);
    blobRef.current = null;
  }

  async function handleCreate() {
    const text = prompt.trim();
    if (!imageUrl || !text) return;
    setStep('processing');
    setError(null);
    clearText();

    try {
      const res = await fetch(proxyUrl(imageUrl));
      if (!res.ok) throw new Error('photo fetch failed');
      const blob = await res.blob();
      const file = new File([blob], `photo.${extFromMime(blob.type)}`, { type: blob.type || 'image/jpeg' });

      const result = await requestCreativeEdit(file, text, ratio);
      if (!result.ok) {
        setError(
          result.code === 'content_moderation' ? t('moderation')
            : result.code === 'no_credits' ? (result.message ?? t('noCredits'))
              : t('error'),
        );
        setStep('configure');
        return;
      }
      setResultUrl(result.url);
      setResultRatio(ratio);
      setStep('result');
      notifyCreditsChanged();
    } catch {
      setError(t('error'));
      setStep('configure');
    }
  }

  async function handleShare(url: string) {
    setSharing(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(proxyUrl(url));
        if (res.ok) blob = await res.blob();
      }
      if (blob) {
        const file = new File([blob], `creative.${extFromMime(blob.type)}`, { type: blob.type });
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
    clearText();
    if (step === 'configure' && fromSearchParams.current) {
      router.back();
    } else if (step === 'configure') {
      setStep('upload');
    } else if (step === 'result') {
      setStep('configure');
    }
  }

  // ── Text overlay editor ───────────────────────────────────────────────────
  if (editingText && displayUrl) {
    return (
      <MobileTextOverlayEditor
        imageUrl={displayUrl}
        onDone={(url) => { setCompositedImage(url); blobRef.current = null; setEditingText(false); }}
        onCancel={() => setEditingText(false)}
      />
    );
  }

  // ── Step: upload ──────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="px-4 pt-6" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <h2 className="mb-1 text-lg font-semibold text-white">{t('title')}</h2>
        <p className="mb-4 text-sm text-gray-400">{t('subtitle')}</p>
        <MobileMediaPicker
          onImageSelected={(url) => { setImageUrl(url); setStep('configure'); }}
          currentImage={undefined}
          onClear={() => {}}
        />
      </div>
    );
  }

  // ── Step: processing ──────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-16" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="max-h-[200px] max-w-full rounded-xl object-contain opacity-60" />
        )}
        <p className="text-sm text-gray-300">{t('processing')}</p>
        <TimedProgressBar durationMs={TYPICAL_DURATION_MS} />
        <p className="text-xs text-gray-500">{t('processingHint')}</p>
      </div>
    );
  }

  // ── Step: configure ───────────────────────────────────────────────────────
  if (step === 'configure') {
    return (
      <div className="flex flex-col pb-40" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <BackButton onClick={handleBack} label={t('back')} />
          <span className="text-base font-semibold text-white">{t('title')}</span>
        </div>

        {imageUrl && (
          <div className="px-4 pb-4">
            <div className="flex justify-center rounded-xl bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="max-h-[220px] max-w-full rounded-xl object-contain" />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Prompt */}
        <div className="px-4 pb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('promptLabel')}</p>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('example1')}
              rows={5}
              maxLength={4000}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-4 pr-14 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none"
            />
            <div className="absolute right-3 bottom-3">
              <MobileVoiceInput onTranscript={handleTranscript} disabled={false} />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">{t('placeholder')}</p>
        </div>

        {/* Ratio */}
        <div className="px-4 pb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('ratioLabel')}</p>
          <div className="flex gap-2">
            {CREATIVE_ASPECT_RATIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRatio(r.id)}
                className={`flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                  ratio === r.id
                    ? 'bg-green-600 text-white'
                    : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
                }`}
              >
                {t(r.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed CTA */}
        <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
          <div className="mx-auto max-w-lg">
            <button
              onClick={() => void handleCreate()}
              disabled={!prompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
              </svg>
              {t('create', { count: CREATIVE_EDIT_CREDITS })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: result ──────────────────────────────────────────────────────────
  if (step === 'result' && imageUrl && displayUrl) {
    return (
      <div className="flex flex-col pb-8" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <BackButton onClick={handleBack} label={t('back')} />
          <span className="text-base font-semibold text-white">{t('result')}</span>
          <div className="w-9" />
        </div>

        <div className="px-4">
          {resultRatio === 'auto' ? (
            <BeforeAfterSlider
              beforeUrl={imageUrl}
              afterUrl={displayUrl}
              beforeLabel={t('original')}
              afterLabel={t('result')}
            />
          ) : (
            // New frame shape — a before/after slider would misalign, show the result alone
            <div className="flex justify-center rounded-xl bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="" className="max-h-[70vh] max-w-full rounded-xl object-contain" />
            </div>
          )}
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-green-400">✓ {t('done')}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t('doneDesc')}</p>
        </div>

        <div className="mt-4 space-y-2 px-4">
          <button
            onClick={() => setEditingText(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            ✏️ {compositedImage ? t('editText') : t('addText')}
          </button>
          {compositedImage && (
            <button onClick={clearText} className="mx-auto block text-xs text-gray-500 active:text-gray-300">
              ✕ {t('removeText')}
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => handleSave(displayUrl)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white active:bg-white/[0.08]"
          >
            💾 {t('save')}
          </button>
          <button
            onClick={() => void handleShare(displayUrl)}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-semibold text-white active:bg-green-700 disabled:opacity-60"
          >
            📤 {t('share')}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 px-4 pb-2">
          <button onClick={() => { clearText(); setStep('configure'); }} className="text-sm text-gray-400 active:text-white">
            🔄 {t('editPrompt')}
          </button>
          <button
            onClick={() => { clearText(); setResultUrl(null); setStep('upload'); fromSearchParams.current = false; }}
            className="text-sm text-gray-400 active:text-white"
          >
            ↩ {t('newPhoto')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
