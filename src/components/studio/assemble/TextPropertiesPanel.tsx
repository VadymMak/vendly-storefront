'use client';

import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import type { TextOverlay } from '@/lib/slideshow-renderer';

interface Props {
  draft: TextOverlay;
  onChange: (updates: Partial<TextOverlay>) => void;
}

// ── Accordion section ─────────────────────────────────────────────────────────

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/6 pt-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between py-0.5 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300"
      >
        <span>{title}</span>
        <span className="text-[9px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mt-1.5 space-y-2">{children}</div>}
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">{label}</span>
        <span className="font-mono text-[10px] text-gray-500">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-green-500"
      />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TextPropertiesPanel({ draft, onChange }: Props) {
  const isBarOrCustom = draft.style === 'bar' || draft.style === 'custom';

  // Determine which field represents "bg color" based on style
  const bgColorValue =
    draft.style === 'bar' ? (draft.barColor ?? '#E85D04') : (draft.bgShapeColor ?? '#000000');
  const bgColorLabel =
    draft.style === 'bar' ? 'Bar color' : 'BG color';

  const setBgColor = (c: string) => {
    if (draft.style === 'bar') onChange({ barColor: c });
    else onChange({ bgShapeColor: c });
  };

  if (!isBarOrCustom) return null;

  return (
    <div className="space-y-0">
      {/* ── Colors ── */}
      <Section title="Colors" defaultOpen>
        <ColorPicker
          label="Text fill"
          value={draft.color ?? '#FFFFFF'}
          onChange={c => onChange({ color: c })}
        />
        <ColorPicker
          label={bgColorLabel}
          value={bgColorValue}
          onChange={setBgColor}
        />
        <ColorPicker
          label="Stroke"
          value={draft.strokeColor ?? '#000000'}
          onChange={c => onChange({ strokeColor: c })}
        />
        <ColorPicker
          label="Shadow"
          value={draft.shadowColor ?? '#000000'}
          onChange={c => onChange({ shadowColor: c })}
        />
      </Section>

      {/* ── Stroke ── */}
      <Section title="Stroke" defaultOpen>
        <Slider
          label="Width"
          value={draft.strokeWidth ?? 0}
          min={0}
          max={20}
          unit="px"
          onChange={v => onChange({ strokeWidth: v })}
        />
      </Section>

      {/* ── Shadow ── */}
      <Section title="Shadow">
        <Slider
          label="Blur"
          value={draft.shadowBlur ?? 0}
          min={0}
          max={40}
          unit="px"
          onChange={v => onChange({ shadowBlur: v })}
        />
        <Slider
          label="Offset X"
          value={draft.shadowOffsetX ?? 0}
          min={-20}
          max={20}
          unit="px"
          onChange={v => onChange({ shadowOffsetX: v })}
        />
        <Slider
          label="Offset Y"
          value={draft.shadowOffsetY ?? 0}
          min={-20}
          max={20}
          unit="px"
          onChange={v => onChange({ shadowOffsetY: v })}
        />
      </Section>

      {/* ── Background Shape (custom only) ── */}
      {draft.style === 'custom' && (
        <Section title="BG Shape">
          <div className="flex gap-1">
            {(['none', 'rect', 'rounded', 'pill'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ bgShape: s })}
                className={[
                  'flex-1 rounded px-1 py-0.5 text-[10px] transition-colors',
                  (draft.bgShape ?? 'none') === s
                    ? 'bg-green-600 text-white'
                    : 'bg-white/8 text-gray-500 hover:bg-white/15',
                ].join(' ')}
              >
                {s === 'none' ? 'Off' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {(draft.bgShape && draft.bgShape !== 'none') && (
            <>
              <Slider
                label="Opacity"
                value={Math.round((draft.bgShapeOpacity ?? 0.8) * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={v => onChange({ bgShapeOpacity: v / 100 })}
              />
              <Slider
                label="Padding"
                value={draft.bgShapePadding ?? 12}
                min={0}
                max={40}
                unit="px"
                onChange={v => onChange({ bgShapePadding: v })}
              />
            </>
          )}
        </Section>
      )}

      {/* ── Typography ── */}
      <Section title="Typography">
        <Slider
          label="Letter spacing"
          value={draft.letterSpacing ?? 0}
          min={0}
          max={30}
          unit="px"
          onChange={v => onChange({ letterSpacing: v })}
        />
        <Slider
          label="Line height"
          value={Math.round((draft.lineHeight ?? 1.2) * 10)}
          min={8}
          max={30}
          step={1}
          unit=""
          onChange={v => onChange({ lineHeight: v / 10 })}
        />
        <div>
          <div className="mb-1 text-[10px] text-gray-600">Transform</div>
          <div className="flex gap-1">
            {(['none', 'uppercase', 'lowercase'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ textTransform: t })}
                className={[
                  'flex-1 rounded px-1 py-0.5 text-[10px] transition-colors',
                  (draft.textTransform ?? 'none') === t
                    ? 'bg-green-600 text-white'
                    : 'bg-white/8 text-gray-500 hover:bg-white/15',
                ].join(' ')}
              >
                {t === 'none' ? 'None' : t === 'uppercase' ? 'AA' : 'aa'}
              </button>
            ))}
          </div>
        </div>
        <Slider
          label="Opacity"
          value={Math.round((draft.opacity ?? 1) * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={v => onChange({ opacity: v / 100 })}
        />
      </Section>
    </div>
  );
}
