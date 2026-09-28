'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PLATFORM_IMAGE_PRESETS } from '@/lib/studio/constants';

const MOBILE_FORMAT_IDS = ['ig-feed', 'ig-story', 'fb-post', 'tiktok', 'product', 'square'] as const;
const FORMATS = PLATFORM_IMAGE_PRESETS.filter((p) => (MOBILE_FORMAT_IDS as readonly string[]).includes(p.id));

interface Props {
  onSelect: (presetId: string) => void;
}

function AspectPreview({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(':').map(Number);
  const maxH = 40;
  const maxW = 40;
  const scale = Math.min(maxW / w, maxH / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  return (
    <div
      className="rounded border border-white/20 bg-white/10"
      style={{ width: pw, height: ph }}
      aria-hidden="true"
    />
  );
}

export function FormatStep({ onSelect }: Props) {
  const t = useTranslations('mobile.format');
  const [selected, setSelected] = useState<string | null>(null);

  function handleTap(id: string) {
    setSelected(id);
    setTimeout(() => onSelect(id), 140);
  }

  return (
    <div className="flex flex-col" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/studio/m" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span className="text-base font-semibold text-white">{t('title')}</span>
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-gray-400">{t('subtitle')}</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-8">
        {FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => handleTap(fmt.id)}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-colors active:scale-[0.97] ${
              selected === fmt.id
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 bg-white/[0.04]'
            }`}
            style={{ minHeight: 120 }}
          >
            <span className="text-2xl">{fmt.icon}</span>
            <AspectPreview ratio={fmt.aspect_ratio} />
            <span className="text-xs font-medium text-white">{fmt.label}</span>
            <span className="text-[10px] text-gray-500">{fmt.aspect_ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
