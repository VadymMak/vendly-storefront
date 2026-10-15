'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CreativeAspectRatio, EditorStatus } from '@/lib/types';
import { CREATIVE_ASPECT_RATIOS } from '@/lib/studio/constants';
import { CREATIVE_EDIT_CREDITS, requestCreativeEdit } from '@/lib/studio/creative-edit';
import { downloadImage } from '@/lib/studio/mobile/share';
import { notifyCreditsChanged } from '@/lib/studio/credits-events';
import { EditorShell } from './shared/EditorShell';
import { BeforeAfterSlider } from './shared/BeforeAfterSlider';
import { ProcessingOverlay } from './shared/ProcessingOverlay';
import { TimedProgressBar } from './shared/TimedProgressBar';

interface CreativeEditEditorProps {
  imageUrl: string;
  imageFile: File;
  onAccept: (resultUrl: string, prompt: string) => void;
  onClose: () => void;
}

type CreativeStep = 'configuring' | 'processing' | 'result';

// Grok 2k edit: 14 s average, 17.6 s p90 (StudioUsageLog)
const TYPICAL_DURATION_MS = 15_000;

const EXAMPLE_KEYS = ['example1', 'example2'] as const;

export function CreativeEditEditor({ imageUrl, imageFile, onAccept, onClose }: CreativeEditEditorProps) {
  const t = useTranslations('creativeEdit');

  const [step, setStep] = useState<CreativeStep>('configuring');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<CreativeAspectRatio>('auto');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // Ratio the shown result was made with — the slider only lines up when the shape is unchanged
  const [resultRatio, setResultRatio] = useState<CreativeAspectRatio>('auto');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setStep('processing');
    setError(null);

    const result = await requestCreativeEdit(imageFile, text, ratio);
    if (!result.ok) {
      setError(
        result.code === 'content_moderation' ? t('moderation')
          : result.code === 'no_credits' ? (result.message ?? t('noCredits'))
            : t('error'),
      );
      setStep('configuring');
      return;
    }
    setResultUrl(result.url);
    setResultRatio(ratio);
    setStep('result');
    notifyCreditsChanged();
  };

  let shellStatus: EditorStatus = 'configuring';
  if (step === 'processing') shellStatus = 'processing';
  if (step === 'result') shellStatus = 'result-ready';

  const shownResult = step === 'result' ? resultUrl : null;
  const isResult = shownResult !== null;

  return (
    <EditorShell
      title={t('title')}
      creditCost={CREATIVE_EDIT_CREDITS}
      status={shellStatus}
      onBack={onClose}
      primaryAction={{
        label: isResult ? t('keep') : t('create', { count: CREATIVE_EDIT_CREDITS }),
        onClick: shownResult ? () => onAccept(shownResult, prompt.trim()) : () => void handleCreate(),
        disabled: step === 'processing' || (step === 'configuring' && !prompt.trim()),
        loading: step === 'processing',
      }}
      secondaryAction={isResult ? { label: t('editPrompt'), onClick: () => setStep('configuring') } : undefined}
      error={error}
      sidebar={
        shownResult ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-sm font-medium text-green-400">✓ {t('done')}</p>
              <p className="mt-1 text-xs text-gray-400">{t('doneDesc')}</p>
            </div>
            <button
              onClick={() => void downloadImage(shownResult)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              💾 {t('save')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">{t('promptLabel')}</p>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={t('placeholder')}
                rows={7}
                maxLength={4000}
                disabled={step === 'processing'}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none"
              />
              <div className="space-y-1.5">
                {EXAMPLE_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setPrompt(t(key))}
                    disabled={step === 'processing'}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-gray-400 transition-colors hover:border-green-500/30 hover:text-gray-200"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">{t('ratioLabel')}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {CREATIVE_ASPECT_RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRatio(r.id)}
                    disabled={step === 'processing'}
                    className={`rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                      ratio === r.id
                        ? 'border-green-500/50 bg-green-500/10 text-white'
                        : 'border-white/10 text-gray-400 hover:border-green-500/30'
                    }`}
                  >
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      }
    >
      {shownResult ? (
        <div className="flex h-full items-center justify-center p-4">
          {resultRatio === 'auto' ? (
            <div className="w-full max-w-3xl">
              <BeforeAfterSlider
                beforeUrl={imageUrl}
                afterUrl={shownResult}
                beforeLabel={t('original')}
                afterLabel={t('result')}
              />
            </div>
          ) : (
            // New frame shape — a before/after slider would misalign, show the result alone
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownResult}
              alt=""
              className="max-h-[75vh] max-w-full rounded-xl border border-white/10 object-contain"
              draggable={false}
            />
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="max-h-[65vh] rounded-xl border border-white/10 object-contain"
              draggable={false}
            />
            <ProcessingOverlay
              visible={step === 'processing'}
              message={t('processing')}
              submessage={t('processingHint')}
            />
          </div>
          {step === 'processing' && <TimedProgressBar durationMs={TYPICAL_DURATION_MS} />}
        </div>
      )}
    </EditorShell>
  );
}
