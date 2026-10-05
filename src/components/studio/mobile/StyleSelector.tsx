'use client';

import { useTranslations } from 'next-intl';
import { STYLE_CHIPS } from '@/lib/studio/constants';
import { MobileOptionSelector } from './MobileOptionSelector';

interface Props {
  selectedStyleId: string;
  /** "Like my photo" only makes sense with a photo */
  hasReference: boolean;
  onSelect: (styleId: string) => void;
}

export function StyleSelector({ selectedStyleId, hasReference, onSelect }: Props) {
  const t = useTranslations('mobile.style');

  const options = [
    ...STYLE_CHIPS.map((s) => ({ id: s.id, icon: s.icon, label: t(`chips.${s.id}`), subtitle: t(s.id) })),
    ...(hasReference ? [{ id: 'reference', icon: '🖼️', label: t('chips.reference'), subtitle: t('referenceDesc') }] : []),
  ];

  return (
    <MobileOptionSelector
      label={t('directionLabel')}
      sheetTitle={t('sheetTitle')}
      closeLabel={t('close')}
      options={options}
      selectedId={selectedStyleId}
      onSelect={onSelect}
    />
  );
}
