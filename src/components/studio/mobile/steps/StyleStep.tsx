'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { STYLE_CHIPS } from '@/lib/studio/constants';

// Primary styles — always visible, in this order (Social first, the default)
const PRIMARY_STYLE_IDS = ['social', 'product', 'food', 'custom'] as const;
const PRIMARY_STYLES = PRIMARY_STYLE_IDS.flatMap((id) => STYLE_CHIPS.filter((s) => s.id === id));

// Secondary styles — hidden behind "More styles"
const SECONDARY_STYLES = STYLE_CHIPS.filter(
  (s) => !(PRIMARY_STYLE_IDS as readonly string[]).includes(s.id),
);

const DESCRIBED_STYLE_IDS = ['product', 'social', 'custom', 'food', 'beauty', 'interior'] as const;
type DescribedStyleId = typeof DESCRIBED_STYLE_IDS[number];

interface Props {
  onGenerate: (styleId: string) => void;
  onBack: () => void;
  hasReferenceImage: boolean;
}

export function StyleStep({ onGenerate, onBack, hasReferenceImage }: Props) {
  const t = useTranslations('mobile.style');
  const [selected, setSelected] = useState<string>('social');
  const [showMore, setShowMore] = useState(false);

  const styles = hasReferenceImage
    ? [...PRIMARY_STYLES, { id: 'reference', label: t('reference'), icon: '🖼️' }]
    : PRIMARY_STYLES;

  function getDesc(id: string): string {
    if (id === 'reference') return t('referenceDesc');
    if ((DESCRIBED_STYLE_IDS as readonly string[]).includes(id)) return t(id as DescribedStyleId);
    return '';
  }

  function renderCard(s: { id: string; label: string; icon: string }) {
    return (
      <button
        key={s.id}
        onClick={() => setSelected(s.id)}
        className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[0.98] ${
          selected === s.id
            ? 'border-green-500 bg-green-500/10'
            : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <span className="text-2xl">{s.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{s.label}</p>
          <p className="mt-0.5 text-xs text-gray-500">{getDesc(s.id)}</p>
        </div>
        {selected === s.id && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
    );
  }

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

      <div className="flex flex-col gap-3 px-4 pb-32">
        {styles.map(renderCard)}

        {/* More styles toggle */}
        {SECONDARY_STYLES.length > 0 && (
          <>
            <button
              onClick={() => setShowMore(!showMore)}
              aria-expanded={showMore}
              className="flex w-full items-center justify-center gap-2 py-3 text-sm text-gray-400"
            >
              <span aria-hidden="true">{showMore ? '▲' : '▼'}</span>
              <span>{showMore ? t('lessStyles') : `${t('moreStyles')} (${SECONDARY_STYLES.length})`}</span>
            </button>
            {showMore && SECONDARY_STYLES.map(renderCard)}
          </>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => onGenerate(selected)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-semibold text-white active:bg-green-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {t('generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
