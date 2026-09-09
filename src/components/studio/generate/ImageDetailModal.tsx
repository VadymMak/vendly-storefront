'use client';

import { useEffect, useState } from 'react';
import { QUICK_FILTERS, PRESET_MAP, type PresetKey, type OutputFormat, type QuickFilterId } from '@/lib/studio/constants';
import type { FluxModel } from '@/lib/studio/constants';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModalImage {
  id: string;
  url: string;
  prompt: string;
  preset: PresetKey;
  format: OutputFormat;
  model: FluxModel;
  createdAt: number;
}

interface Props {
  img: ModalImage;
  onClose: () => void;
  onAnimate: () => void;
  onAddToAssemble: () => void;
  onDownload: () => void;
  onCopy: () => void;
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImageDetailModal({ img, onClose, onAnimate, onAddToAssemble, onDownload, onCopy }: Props) {
  const [activeFilter, setActiveFilter] = useState<QuickFilterId>('original');
  const [copied, setCopied] = useState(false);

  const preset = PRESET_MAP[img.preset];
  const cssFilter = QUICK_FILTERS.find(f => f.id === activeFilter)?.filter ?? 'none';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
        >
          <IconX />
        </button>

        {/* Image */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/40 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.prompt}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
            style={{ filter: cssFilter !== 'none' ? cssFilter : undefined }}
          />
        </div>

        {/* Sidebar */}
        <div className="flex w-[280px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/10 p-4">
          {/* Prompt */}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">Prompt</p>
            <p className="text-sm text-gray-200">{img.prompt}</p>
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
            <div className="flex justify-between py-0.5">
              <span>Preset</span><span className="text-white">{preset.label}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Size</span><span className="text-white">{preset.display}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Format</span><span className="text-white">{img.format.toUpperCase()}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Model</span><span className="text-white">Flux {img.model}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Created</span>
              <span className="text-white">{new Date(img.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Quick filters */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-400">Filters</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as QuickFilterId)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    activeFilter === f.id
                      ? 'border-green-600/60 bg-green-600/10 text-green-400'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onAnimate}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <IconPlay /> Animate →
            </button>
            <button
              onClick={onAddToAssemble}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <IconLayers /> Add to Assemble
            </button>
            <div className="flex gap-2">
              <button
                onClick={onDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <IconDownload /> Download
              </button>
              <button
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <IconCopy />
                {copied ? <span className="text-green-400">Copied!</span> : 'Copy prompt'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
