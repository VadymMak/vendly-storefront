'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface ColorPickerProps {
  value: string;           // hex like '#ff6600'
  onChange: (hex: string) => void;
  label?: string;
  hint?: string;
  /** Preset swatches shown below the picker */
  presets?: string[];
}

// ── Color conversion helpers ────────────────────────────────────────────────

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ── Default presets ─────────────────────────────────────────────────────────

const DEFAULT_PRESETS = [
  '#000000', '#1e293b', '#374151', '#6b7280',
  '#ffffff', '#f8fafc', '#f3f4f6', '#d1d5db',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ── Component ───────────────────────────────────────────────────────────────

export default function ColorPicker({
  value,
  onChange,
  label,
  hint,
  presets = DEFAULT_PRESETS,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#000000'));
  const [hexInput, setHexInput] = useState(value || '#000000');
  const panelRef = useRef<HTMLDivElement>(null);
  const satRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (isValidHex(value) && value.toLowerCase() !== hsvToHex(hsv.h, hsv.s, hsv.v).toLowerCase()) {
      const newHsv = hexToHsv(value);
      setHsv(newHsv);
      setHexInput(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyHsv = useCallback((h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // ── Saturation/Brightness square drag ───────────────────────────────────

  const handleSatPointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = satRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    applyHsv(hsv.h, x, 1 - y);
  }, [hsv.h, applyHsv]);

  const handleSatDown = (e: React.PointerEvent) => {
    handleSatPointer(e);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => handleSatPointer(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ── Hue slider drag ────────────────────────────────────────────────────

  const handleHuePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    applyHsv(x * 360, hsv.s, hsv.v);
  }, [hsv.s, hsv.v, applyHsv]);

  const handleHueDown = (e: React.PointerEvent) => {
    handleHuePointer(e);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => handleHuePointer(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ── Hex input ─────────────────────────────────────────────────────────

  const handleHexChange = (raw: string) => {
    let v = raw;
    if (!v.startsWith('#')) v = '#' + v;
    setHexInput(v);
    if (isValidHex(v)) {
      const newHsv = hexToHsv(v);
      setHsv(newHsv);
      onChange(v.toLowerCase());
    }
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const pureHue = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="relative" ref={panelRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-secondary">{label}</label>
      )}
      {hint && (
        <p className="mb-2 text-xs text-gray-400">{hint}</p>
      )}

      {/* Trigger button — swatch + hex code */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition-all hover:border-gray-300 hover:shadow-sm"
      >
        <span
          className="block h-7 w-7 rounded-lg border border-gray-200 shadow-inner"
          style={{ backgroundColor: currentHex }}
        />
        <span className="font-mono text-sm font-medium text-gray-700 uppercase">
          {currentHex}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`ml-1 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">

          {/* Saturation / Brightness square */}
          <div
            ref={satRef}
            className="relative h-44 w-full cursor-crosshair rounded-xl"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
            }}
            onPointerDown={handleSatDown}
          >
            {/* Picker circle */}
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: currentHex,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            className="relative mt-3 h-3.5 w-full cursor-pointer rounded-full"
            style={{
              background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            }}
            onPointerDown={handleHueDown}
          >
            <div
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: pureHue,
              }}
            />
          </div>

          {/* Hex input + preview */}
          <div className="mt-3 flex items-center gap-3">
            <span
              className="block h-9 w-9 shrink-0 rounded-lg border border-gray-200 shadow-inner"
              style={{ backgroundColor: currentHex }}
            />
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                HEX
              </span>
              <input
                type="text"
                value={hexInput.toUpperCase()}
                onChange={(e) => handleHexChange(e.target.value)}
                maxLength={7}
                className="w-full rounded-lg border border-gray-200 py-2 pl-12 pr-3 font-mono text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Preset swatches */}
          {presets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const newHsv = hexToHsv(preset);
                    setHsv(newHsv);
                    setHexInput(preset);
                    onChange(preset);
                  }}
                  className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
                    preset.toLowerCase() === currentHex.toLowerCase()
                      ? 'border-green-500 ring-2 ring-green-500/30'
                      : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
