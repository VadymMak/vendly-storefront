'use client';

import { useEffect, useState } from 'react';
import { QUICK_FILTERS, PRESET_MAP, type PresetKey, type QuickFilterId } from '@/lib/studio/constants';
import { InpaintEditor } from './InpaintEditor';
import { SceneCreator } from './SceneCreator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModalImage {
  id: string;
  url: string;
  prompt?: string;
  preset?: string;
  format?: string;
  model?: string;
  provider?: string;
  createdAt: number;
}

interface Props {
  img: ModalImage;
  onClose: () => void;
  onAnimate: () => void;
  onAddToAssemble: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onInpaintResult?: (url: string) => void;
  galleryImages?: string[];
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

function IconBrush() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImageDetailModal({ img, onClose, onAnimate, onAddToAssemble, onDownload, onCopy, onInpaintResult, galleryImages }: Props) {
  const [activeFilter, setActiveFilter] = useState<QuickFilterId>('original');
  const [copied, setCopied] = useState(false);
  const [showInpaint, setShowInpaint] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [showSceneCreator, setShowSceneCreator] = useState(false);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);

  const preset = PRESET_MAP[img.preset as PresetKey] ?? Object.values(PRESET_MAP)[0];
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

  async function handleRemoveBg() {
    setIsRemovingBg(true);
    try {
      const imgRes = await fetch(img.url);
      const imgBlob = await imgRes.blob();
      const fd = new FormData();
      fd.append('image', imgBlob, 'image.png');
      const res = await fetch('/api/studio/remove-bg', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Remove background failed');
      }
      const data = await res.json() as { url: string };
      setCutoutUrl(data.url);
      onInpaintResult?.(data.url);
    } catch (err) {
      console.error('[RemoveBg] Error:', err);
      alert(err instanceof Error ? err.message : 'Remove background failed');
    } finally {
      setIsRemovingBg(false);
    }
  }

  return (
    <>
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
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/40 p-4">
          {cutoutUrl && (
            <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-gray-300">
              ✂️ Background Removed
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cutoutUrl ?? img.url}
            alt={img.prompt ?? ''}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
            style={{ filter: !cutoutUrl && cssFilter !== 'none' ? cssFilter : undefined }}
          />
          {cutoutUrl && (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <button
                onClick={async () => {
                  const res = await fetch(cutoutUrl);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cutout-${Date.now()}.png`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
              >
                💾 Save Cutout
              </button>
              <button
                onClick={() => setCutoutUrl(null)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5"
              >
                Show Original
              </button>
            </div>
          )}
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
              <span>Format</span><span className="text-white">{img.format?.toUpperCase()}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Model</span>
              <span className="text-white text-right">
                {img.model ?? 'Unknown'}
                {img.provider && <span className="ml-1 text-gray-400 text-[11px]">via {img.provider}</span>}
              </span>
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
              onClick={() => setShowInpaint(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              <IconBrush />
              Inpaint / Edit
            </button>
            <button
              onClick={handleRemoveBg}
              disabled={isRemovingBg}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {isRemovingBg ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" />
                  </svg>
                  Removing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 2l20 20" />
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M7 7l10 10" />
                  </svg>
                  Remove Background
                </>
              )}
            </button>
            <button
              onClick={() => setShowSceneCreator(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800"
            >
              Create Scene
            </button>
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
            <button
              onClick={onDownload}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <IconDownload /> Download
            </button>
            <button
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <IconCopy />
              {copied ? <span className="text-green-400">Copied!</span> : 'Copy prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
    {showInpaint && (
      <InpaintEditor
        imageUrl={img.url}
        onClose={() => setShowInpaint(false)}
        onResult={(url) => {
          setShowInpaint(false);
          onInpaintResult?.(url);
        }}
      />
    )}
    {showSceneCreator && (
      <SceneCreator
        cutoutUrl={img.url}
        onClose={() => setShowSceneCreator(false)}
        onResult={(url) => { setShowSceneCreator(false); onInpaintResult?.(url); }}
        galleryImages={galleryImages}
      />
    )}
    </>
  );
}
