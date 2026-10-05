'use client';

import { useTranslations } from 'next-intl';
import { DESTINATION_OPTIONS, PLATFORM_IMAGE_PRESETS } from '@/lib/studio/constants';
import { MobileOptionSelector } from './MobileOptionSelector';

interface Props {
  selectedPresetId: string;
  onSelect: (presetId: string) => void;
}

export function DestinationSelector({ selectedPresetId, onSelect }: Props) {
  const t = useTranslations('mobile.destination');

  const options = DESTINATION_OPTIONS.map((d) => ({
    id: d.presetId, icon: d.icon, label: t(d.key), subtitle: t(`${d.key}Sub`),
  }));
  // A preset outside the three destinations (e.g. set via ?remake=) still shows its own label.
  const preset = PLATFORM_IMAGE_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <MobileOptionSelector
      label={t('postFor')}
      sheetTitle={t('sheetTitle')}
      closeLabel={t('close')}
      options={options}
      selectedId={selectedPresetId}
      fallback={preset && { id: preset.id, icon: preset.icon, label: preset.label, subtitle: preset.subtitle }}
      onSelect={onSelect}
    />
  );
}
