'use client';

import { useState, useEffect, useCallback, useId } from 'react';

export interface MobileOption {
  id: string;
  icon?: string;
  label?: string;
  subtitle?: string;
}

interface Props {
  /** Small uppercase label above the row, e.g. "Post for" */
  label: string;
  sheetTitle: string;
  closeLabel: string;
  options: readonly MobileOption[];
  selectedId: string;
  /** Shown in the row when selectedId is not one of the options (e.g. a ?remake= preset) */
  fallback?: MobileOption;
  onSelect: (id: string) => void;
}

/** Compact row that opens a bottom sheet of options — tap selects and closes. */
export function MobileOptionSelector({ label, sheetTitle, closeLabel, options, selectedId, fallback, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const titleId = useId();
  const current = options.find((o) => o.id === selectedId) ?? fallback;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left active:bg-white/[0.08]"
      >
        <span className="text-xl" aria-hidden="true">{current?.icon}</span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-white">{current?.label}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{current?.subtitle}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open && (
        // z-[60] — above the bottom nav (z-50) and the fixed Generate CTA (z-40)
        <div className="fixed inset-0 z-[60] flex items-end" role="presentation">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={close}
            className="absolute inset-0 bg-black/50"
            style={{ animation: 'fade-in 0.2s ease-out' }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#111118] px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            style={{ animation: 'slideUp 0.25s ease-out' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            <p id={titleId} className="mb-4 text-base font-semibold text-white">{sheetTitle}</p>

            <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={titleId}>
              {options.map((o) => {
                const selected = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => { onSelect(o.id); close(); }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99] ${
                      selected ? 'border-green-500 bg-green-500/15' : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">{o.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-white">{o.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{o.subtitle}</span>
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
      )}
    </div>
  );
}
