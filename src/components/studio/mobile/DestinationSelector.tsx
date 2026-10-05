'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { DESTINATION_OPTIONS, PLATFORM_IMAGE_PRESETS } from '@/lib/studio/constants';
import { DestinationSheet } from './DestinationSheet';

interface Props {
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
}

export function DestinationSelector({ selectedPresetId, onSelect }: Props) {
  const t = useTranslations('mobile.destination');
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // A preset outside the three destinations (e.g. set via ?remake=) still shows its own label.
  const destination = DESTINATION_OPTIONS.find((d) => d.presetId === selectedPresetId);
  const preset      = PLATFORM_IMAGE_PRESETS.find((p) => p.id === selectedPresetId);
  const icon     = destination?.icon ?? preset?.icon;
  const label    = destination ? t(destination.key) : preset?.label;
  const subtitle = destination ? t(`${destination.key}Sub`) : preset?.subtitle;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t('postFor')}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left active:bg-white/[0.08]"
      >
        <span className="text-xl" aria-hidden="true">{icon}</span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-white">{label}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{subtitle}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <DestinationSheet
        isOpen={open}
        selectedPresetId={selectedPresetId}
        onSelect={(id) => { onSelect(id); setOpen(false); }}
        onClose={close}
      />
    </div>
  );
}
