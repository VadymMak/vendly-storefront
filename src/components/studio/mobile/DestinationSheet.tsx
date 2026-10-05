'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DESTINATION_OPTIONS } from '@/lib/studio/constants';

interface Props {
  isOpen: boolean;
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
  onClose: () => void;
}

export function DestinationSheet({ isOpen, selectedPresetId, onSelect, onClose }: Props) {
  const t = useTranslations('mobile.destination');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // z-[60] — above the bottom nav (z-50) and the fixed Generate CTA (z-40)
    <div className="fixed inset-0 z-[60] flex items-end" role="presentation">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        style={{ animation: 'fade-in 0.2s ease-out' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-sheet-title"
        className="relative mx-auto w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-[#111118] px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <p id="destination-sheet-title" className="mb-4 text-base font-semibold text-white">{t('sheetTitle')}</p>

        <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="destination-sheet-title">
          {DESTINATION_OPTIONS.map((d) => {
            const selected = d.presetId === selectedPresetId;
            return (
              <button
                key={d.presetId}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(d.presetId)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99] ${
                  selected ? 'border-green-500 bg-green-500/15' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <span className="text-xl" aria-hidden="true">{d.icon}</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">{t(d.key)}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{t(`${d.key}Sub`)}</span>
                </span>
                {selected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
