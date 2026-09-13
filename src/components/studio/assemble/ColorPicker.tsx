'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

const HexAlphaColorPicker = dynamic(
  () => import('react-colorful').then(m => m.HexAlphaColorPicker),
  { ssr: false, loading: () => <div className="h-[160px] w-full animate-pulse rounded bg-white/5" /> },
);

const PRESETS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00',
  '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF5733', '#E85D04', '#FFC300', '#DAF7A6',
  '#900C3F', '#581845', '#1A5276', '#2E86C1',
];

// Shared recent colors across all picker instances in the session
const recentColors: string[] = [];

function toHex8(hex: string): string {
  const h = (hex || '#000000').replace('#', '');
  if (h.length === 3)  return '#' + h.split('').map(c => c + c).join('') + 'ff';
  if (h.length === 4)  return '#' + h.split('').map(c => c + c).join('');
  if (h.length === 6)  return '#' + h + 'ff';
  if (h.length === 8)  return '#' + h;
  return '#000000ff';
}

// Strip 'ff' alpha suffix for backward compat with 6-char existing colors
function normalizeOut(hex8: string): string {
  if (!hex8) return '#000000';
  const h = hex8.replace('#', '').toLowerCase();
  if (h.length === 8 && h.slice(6) === 'ff') return '#' + h.slice(0, 6);
  return hex8.toLowerCase();
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  showAlpha?: boolean;
}

export function ColorPicker({ label, value, onChange, showAlpha = false }: ColorPickerProps) {
  const [open, setOpen]   = useState(false);
  const [hex8, setHex8]   = useState(() => toHex8(value));
  const [hexInput, setHexInput] = useState(() => (value || '#000000').replace('#', '').toUpperCase());
  const [, forceRender]   = useState(0);

  // Sync when value changes externally
  useEffect(() => {
    const h8 = toHex8(value);
    setHex8(h8);
    setHexInput(h8.replace('#', '').toUpperCase());
  }, [value]);

  const commit = useCallback((rawHex: string) => {
    const h8  = toHex8(rawHex);
    const out = showAlpha ? h8 : normalizeOut(h8);
    setHex8(h8);
    setHexInput(h8.replace('#', '').toUpperCase());
    onChange(out);
    const recent = recentColors;
    const idx = recent.indexOf(out);
    if (idx !== -1) recent.splice(idx, 1);
    recent.unshift(out);
    if (recent.length > 8) recent.length = 8;
    forceRender(n => n + 1);
  }, [onChange, showAlpha]);

  const handlePickerChange = useCallback((c: string) => {
    setHex8(c);
    setHexInput(c.replace('#', '').toUpperCase());
    const out = showAlpha ? c : normalizeOut(c);
    onChange(out);
  }, [onChange, showAlpha]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '');
    setHexInput(raw.toUpperCase());
    if (raw.length === 6 || raw.length === 8) {
      commit('#' + raw);
    }
  }, [commit]);

  const handleEyedropper = useCallback(async () => {
    if (!('EyeDropper' in window)) return;
    try {
      // @ts-expect-error — EyeDropper not in TS lib yet
      const dropper = new EyeDropper();
      const result = await dropper.open();
      commit(result.sRGBHex);
    } catch {
      // user cancelled
    }
  }, [commit]);

  const displayColor = normalizeOut(hex8);

  return (
    <div>
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/5"
      >
        <span
          className="h-4 w-4 shrink-0 rounded border border-white/20"
          style={{ backgroundColor: displayColor }}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-gray-400">{label}</span>
        <span className="font-mono text-[10px] text-gray-500">
          {displayColor.toUpperCase()}
        </span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-1 rounded border border-white/8 bg-black/40 p-2">
          {/* Preset grid 4×4 */}
          <div className="mb-2 grid grid-cols-8 gap-1">
            {PRESETS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => commit(c)}
                className={[
                  'h-5 w-full rounded border transition-transform hover:scale-110',
                  normalizeOut(hex8) === c ? 'border-white/60 ring-1 ring-white/30' : 'border-white/10',
                ].join(' ')}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* HSV wheel */}
          <div className="[&_.react-colorful]:h-[150px] [&_.react-colorful]:w-full">
            <HexAlphaColorPicker color={hex8} onChange={handlePickerChange} />
          </div>

          {/* Hex input + eyedropper */}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600">#</span>
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInput}
              maxLength={8}
              className="flex-1 rounded bg-white/8 px-2 py-0.5 font-mono text-[11px] uppercase text-white outline-none focus:ring-1 focus:ring-green-600/60"
              spellCheck={false}
            />
            {'EyeDropper' in (typeof window !== 'undefined' ? window : {}) && (
              <button
                type="button"
                onClick={handleEyedropper}
                className="rounded bg-white/8 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-white/15 hover:text-white"
                title="Eyedropper"
              >
                👁
              </button>
            )}
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[9px] uppercase tracking-wider text-gray-600">Recent</div>
              <div className="flex gap-1">
                {recentColors.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => commit(c)}
                    className="h-4 w-4 shrink-0 rounded border border-white/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
