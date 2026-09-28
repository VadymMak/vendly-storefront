'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadGoogleFont } from '@/lib/fonts/font-loader';
import type { MobileTextLayer } from '@/lib/types';

interface Props {
  layer: MobileTextLayer;
  onChange: (updates: Partial<MobileTextLayer>) => void;
  onDelete: () => void;
}

const MOBILE_FONTS = [
  'Inter',
  'Montserrat',
  'Roboto',
  'Oswald',
  'Playfair Display',
  'Pacifico',
  'Bebas Neue',
  'DM Sans',
] as const;

const COLOR_PRESETS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FFCC00',
  '#34C759', '#007AFF', '#FF9500', '#AF52DE',
];

export function TextStylePanel({ layer, onChange, onDelete }: Props) {
  const t = useTranslations('mobile.textEditor');
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set(['Inter']));

  // Pre-load the current font when the panel opens
  useEffect(() => {
    const w = layer.fontWeight === 'bold' ? 700 : 400;
    loadGoogleFont(layer.fontFamily, w)
      .then(() => setLoadedFonts(prev => new Set(prev).add(layer.fontFamily)))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFontSelect(family: string) {
    const w = layer.fontWeight === 'bold' ? 700 : 400;
    try {
      await loadGoogleFont(family, w);
      setLoadedFonts(prev => new Set(prev).add(family));
    } catch {}
    onChange({ fontFamily: family });
  }

  async function handleBoldToggle() {
    const next = layer.fontWeight === 'bold' ? 'normal' : 'bold';
    if (next === 'bold') {
      try { await loadGoogleFont(layer.fontFamily, 700); } catch {}
    }
    onChange({ fontWeight: next });
  }

  function handleAlignCycle() {
    const order: MobileTextLayer['textAlign'][] = ['left', 'center', 'right'];
    const next = order[(order.indexOf(layer.textAlign) + 1) % 3];
    onChange({ textAlign: next });
  }

  function handleBgToggle() {
    if (layer.backgroundColor) {
      onChange({ backgroundColor: undefined });
    } else {
      onChange({ backgroundColor: 'rgba(0,0,0,0.6)', bgPadding: 8 });
    }
  }

  const ALIGN_ICONS = { left: '≡L', center: '≡C', right: '≡R' };

  return (
    <div
      className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-white/10 bg-[#111118] px-4 pb-[env(safe-area-inset-bottom)]"
      style={{
        bottom: 'calc(4rem + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.25s ease-out',
      }}
    >
      {/* Text input */}
      <div className="pt-4 pb-3">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={layer.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={t('placeholder')}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none"
        />
      </div>

      {/* Font picker */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
        {MOBILE_FONTS.map((font) => (
          <button
            key={font}
            onClick={() => handleFontSelect(font)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              layer.fontFamily === font
                ? 'border-green-500 bg-green-500/10 text-green-400'
                : 'border-white/10 bg-white/[0.04] text-gray-300'
            }`}
            style={loadedFonts.has(font) ? { fontFamily: `"${font}", sans-serif` } : undefined}
          >
            {font}
          </button>
        ))}
      </div>

      {/* Size + Bold row */}
      <div className="flex items-center gap-4 pb-3">
        <span className="text-xs text-gray-500">{t('size')}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ fontSize: Math.max(14, layer.fontSize - 2) })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white active:bg-white/[0.12]"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-medium text-white">{layer.fontSize}</span>
          {(layer.scale ?? 1) !== 1 && (
            <span className="text-[10px] text-gray-500">×{(layer.scale ?? 1).toFixed(1)}</span>
          )}
          <button
            onClick={() => onChange({ fontSize: Math.min(72, layer.fontSize + 2) })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white active:bg-white/[0.12]"
          >
            +
          </button>
        </div>

        <button
          onClick={handleBoldToggle}
          className={`ml-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
            layer.fontWeight === 'bold'
              ? 'border-green-500 bg-green-500/10 text-green-400'
              : 'border-white/10 bg-white/[0.04] text-gray-300'
          }`}
        >
          B
        </button>

        <button
          onClick={handleAlignCycle}
          className="ml-auto rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-300"
        >
          {ALIGN_ICONS[layer.textAlign]}
        </button>

        <button
          onClick={handleBgToggle}
          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
            layer.backgroundColor
              ? 'border-green-500 bg-green-500/10 text-green-400'
              : 'border-white/10 bg-white/[0.04] text-gray-300'
          }`}
        >
          {t('background')}
        </button>
      </div>

      {/* Color presets */}
      <div className="flex items-center gap-2 pb-3">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            onClick={() => onChange({ color })}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform active:scale-90 ${
              layer.color === color ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
        <label className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-base">
          🎨
          <input
            type="color"
            value={layer.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="sr-only"
          />
        </label>
      </div>

      {/* Delete */}
      <div className="flex justify-end pb-2">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 active:bg-red-500/20"
        >
          🗑️ {t('delete')}
        </button>
      </div>
    </div>
  );
}
