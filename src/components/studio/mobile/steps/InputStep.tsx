'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MobileMediaPicker } from '../MobileMediaPicker';
import { MobileVoiceInput } from '../MobileVoiceInput';

interface Props {
  onContinue: (data: { description: string; referenceImageUrl?: string }) => void;
  onBack: () => void;
}

export function InputStep({ onContinue, onBack }: Props) {
  const t = useTranslations('mobile.input');
  const EXAMPLES = [t('example1'), t('example2'), t('example3')];
  const [description, setDescription] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [exampleIndex, setExampleIndex] = useState(0);

  const handleTranscript = useCallback((text: string) => {
    setDescription((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  function nextExample() {
    setExampleIndex((i) => (i + 1) % EXAMPLES.length);
  }

  function fillExample() {
    setDescription(EXAMPLES[exampleIndex]);
    nextExample();
  }

  const canContinue = description.trim().length >= 3;

  return (
    <div className="flex flex-col" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <span className="text-base font-semibold text-white">{t('title')}</span>
        </div>
        <span className="text-xs text-gray-500">2/4</span>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-32">
        {/* Photo picker */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('referenceLabel')}</p>
          <MobileMediaPicker
            onImageSelected={setReferenceImageUrl}
            currentImage={referenceImageUrl}
            onClear={() => setReferenceImageUrl(undefined)}
          />
        </div>

        {/* Description */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('describeLabel')}</p>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('describePlaceholder')}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-4 pr-14 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none"
            />
            <div className="absolute right-3 bottom-3">
              <MobileVoiceInput onTranscript={handleTranscript} disabled={false} />
            </div>
          </div>
        </div>

        {/* Examples */}
        <div>
          <button
            type="button"
            onClick={fillExample}
            className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left active:bg-white/[0.06]"
          >
            <span className="mt-0.5 text-base">💡</span>
            <div>
              <p className="text-xs font-medium text-gray-400">{t('tapExample')}</p>
              <p className="mt-0.5 text-sm text-gray-500 italic">&quot;{EXAMPLES[exampleIndex]}&quot;</p>
            </div>
          </button>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => onContinue({ description: description.trim(), referenceImageUrl })}
            disabled={!canContinue}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700 disabled:opacity-40"
          >
            {t('continue')}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
