'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { STYLE_CHIPS } from '@/lib/studio/constants';
import { MobileMediaPicker } from '../MobileMediaPicker';
import { MobileVoiceInput } from '../MobileVoiceInput';

interface Props {
  onContinue: (data: { description: string; referenceImageUrl?: string; styleId: string }) => void;
  onBack: () => void;
  /** Wizard state to restore when returning here ("Change direction", or after a failed generation) */
  initialDescription?: string;
  initialReferenceImageUrl?: string;
  initialStyleId?: string;
}

type StyleOptionId = typeof STYLE_CHIPS[number]['id'] | 'reference';

const DEFAULT_STYLE_ID = 'social';

export function InputStep({ onContinue, onBack, initialDescription, initialReferenceImageUrl, initialStyleId }: Props) {
  const t = useTranslations('mobile.input');
  const tStyle = useTranslations('mobile.style');
  const EXAMPLES = [t('example1'), t('example2'), t('example3')];
  const searchParams = useSearchParams();
  // ?prompt= comes from "Make a Story" on the result screen — start from the original description
  const [description, setDescription] = useState(() => initialDescription || (searchParams.get('prompt') ?? ''));
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>(initialReferenceImageUrl);
  const [styleId, setStyleId] = useState<string>(() =>
    initialStyleId && (initialStyleId !== 'reference' || initialReferenceImageUrl) ? initialStyleId : DEFAULT_STYLE_ID,
  );

  // "Like my photo" only makes sense with a photo
  const styleOptions: StyleOptionId[] = [
    ...STYLE_CHIPS.map((s) => s.id),
    ...(referenceImageUrl ? ['reference' as const] : []),
  ];
  const styleIcon = (id: StyleOptionId) => (id === 'reference' ? '🖼️' : STYLE_CHIPS.find((s) => s.id === id)?.icon);
  const styleDesc = (id: string) => (id === 'reference' ? tStyle('referenceDesc') : tStyle(id as typeof STYLE_CHIPS[number]['id']));

  function clearReference() {
    setReferenceImageUrl(undefined);
    if (styleId === 'reference') setStyleId(DEFAULT_STYLE_ID);
  }
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
        <span className="text-xs text-gray-500">{t('step')}</span>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-40">
        {/* Photo picker */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('referenceLabel')}</p>
          <MobileMediaPicker
            onImageSelected={setReferenceImageUrl}
            currentImage={referenceImageUrl}
            onClear={clearReference}
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

        {/* Creative direction */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{tStyle('directionLabel')}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tStyle('directionLabel')}>
            {styleOptions.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={styleId === id}
                onClick={() => setStyleId(id)}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors active:scale-[0.97] ${
                  styleId === id
                    ? 'border-green-500 bg-green-500/15 text-white'
                    : 'border-white/10 bg-white/[0.04] text-gray-400'
                }`}
              >
                <span className="text-base" aria-hidden="true">{styleIcon(id)}</span>
                <span>{tStyle(`chips.${id}`)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{styleDesc(styleId)}</p>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => onContinue({ description: description.trim(), referenceImageUrl, styleId })}
            disabled={!canContinue}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700 disabled:bg-green-900 disabled:text-white/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {tStyle('generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
