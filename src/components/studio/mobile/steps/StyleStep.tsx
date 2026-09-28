'use client';

import { useState } from 'react';
import { STYLE_CHIPS } from '@/lib/studio/constants';

const MOBILE_STYLE_IDS = ['product', 'social', 'custom'] as const;
const STYLES = STYLE_CHIPS.filter((s) => (MOBILE_STYLE_IDS as readonly string[]).includes(s.id));

const STYLE_DESC: Record<string, string> = {
  product: 'Clean, professional, studio lighting',
  social:  'Vibrant, eye-catching, trending aesthetic',
  custom:  'Best style for your content',
};

interface Props {
  onGenerate: (styleId: string) => void;
  onBack: () => void;
  hasReferenceImage: boolean;
}

export function StyleStep({ onGenerate, onBack, hasReferenceImage }: Props) {
  const [selected, setSelected] = useState<string>('product');

  const styles = hasReferenceImage
    ? [...STYLES, { id: 'reference', label: 'Like my photo', icon: '🖼️' }]
    : STYLES;

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
          <span className="text-base font-semibold text-white">Choose a style</span>
        </div>
        <span className="text-xs text-gray-500">3/4</span>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-32">
        {styles.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`flex items-center gap-4 rounded-2xl border px-4 py-5 text-left transition-colors active:scale-[0.98] ${
              selected === s.id
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{s.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {s.id === 'reference' ? 'Match the style from your photo' : STYLE_DESC[s.id] ?? ''}
              </p>
            </div>
            {selected === s.id && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => onGenerate(selected)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
