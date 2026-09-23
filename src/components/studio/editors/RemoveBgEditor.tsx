'use client';

import { useState } from 'react';
import type { EditorStatus } from '@/lib/types';
import { EditorShell } from './shared/EditorShell';
import { ProcessingOverlay } from './shared/ProcessingOverlay';

type BgMode = 'transparent' | 'white' | 'gray' | 'custom';

interface RemoveBgEditorProps {
  imageUrl: string;
  imageFile: File;
  onAccept: (resultUrl: string) => void;
  onClose: () => void;
}

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #374151 25%, transparent 25%),
    linear-gradient(-45deg, #374151 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #374151 75%),
    linear-gradient(-45deg, transparent 75%, #374151 75%)`,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  backgroundColor: '#1f2937',
};

function bgStyle(mode: BgMode, customColor: string): React.CSSProperties {
  if (mode === 'transparent') return CHECKERBOARD;
  if (mode === 'white') return { background: '#ffffff' };
  if (mode === 'gray') return { background: '#f3f4f6' };
  return { background: customColor };
}

const BG_OPTIONS = [
  { id: 'transparent' as const, label: 'Transparent', desc: 'PNG with alpha channel' },
  { id: 'white' as const, label: 'White', desc: 'Clean white background' },
  { id: 'gray' as const, label: 'Light gray', desc: 'Soft neutral background' },
  { id: 'custom' as const, label: 'Custom color', desc: 'Pick any color' },
] as const;

function swatchStyle(id: BgMode, customColor: string): React.CSSProperties {
  if (id === 'transparent') return {
    backgroundImage: 'linear-gradient(45deg, #374151 25%, #1f2937 25%, #1f2937 50%, #374151 50%, #374151 75%, #1f2937 75%)',
    backgroundSize: '8px 8px',
  };
  if (id === 'white') return { background: '#ffffff' };
  if (id === 'gray') return { background: '#f3f4f6' };
  return { background: customColor };
}

function RemoveBgSettingsPanel({ bgMode, onBgModeChange, customColor, onCustomColorChange }: {
  bgMode: BgMode;
  onBgModeChange: (mode: BgMode) => void;
  customColor: string;
  onCustomColorChange: (color: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Output background</p>
      <div className="space-y-2">
        {BG_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onBgModeChange(opt.id)}
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              bgMode === opt.id
                ? 'border-green-500/50 bg-green-500/10 text-white'
                : 'border-white/10 text-gray-300 hover:border-green-500/30 hover:bg-green-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-6 shrink-0 rounded border border-white/20"
                style={swatchStyle(opt.id, customColor)}
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </div>
          </button>
        ))}

        {bgMode === 'custom' && (
          <div className="flex items-center gap-3 pt-1">
            <input
              type="color"
              value={customColor}
              onChange={e => onCustomColorChange(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-white/20 bg-transparent"
            />
            <span className="text-xs text-gray-400">{customColor}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="text-xs text-gray-500">
          The AI removes the background automatically. You can change the preview background after processing — no extra credits needed.
        </p>
      </div>
    </div>
  );
}

function RemoveBgResultPanel({ bgMode, onBgModeChange, customColor, onCustomColorChange }: {
  bgMode: BgMode;
  onBgModeChange: (mode: BgMode) => void;
  customColor: string;
  onCustomColorChange: (color: string) => void;
}) {
  const labels: Record<BgMode, string> = {
    transparent: '▦ Transparent',
    white: '◻ White',
    gray: '◻ Gray',
    custom: '🎨 Custom',
  };
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Preview background</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as BgMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => onBgModeChange(mode)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              bgMode === mode
                ? 'border-green-500/50 bg-green-500/10 text-white'
                : 'border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {labels[mode]}
          </button>
        ))}
      </div>

      {bgMode === 'custom' && (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customColor}
            onChange={e => onCustomColorChange(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-white/20 bg-transparent"
          />
          <span className="text-xs text-gray-400">{customColor}</span>
        </div>
      )}

      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
        <p className="text-xs text-green-400">
          Background removed! Change the preview background above — free, no extra credits.
        </p>
      </div>
    </div>
  );
}

export function RemoveBgEditor({ imageUrl, imageFile, onAccept, onClose }: RemoveBgEditorProps) {
  const [status, setStatus] = useState<EditorStatus>('configuring');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<BgMode>('transparent');
  const [customColor, setCustomColor] = useState('#f0fdf4');

  const handleRemoveBg = async () => {
    setStatus('processing');
    setError(null);

    try {
      const fd = new FormData();
      fd.append('image', imageFile);

      const res = await fetch('/api/remove-bg', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Background removal failed');
      }
      const data = await res.json() as { url: string };

      setResultUrl(data.url);
      setStatus('result-ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Background removal failed');
      setStatus('configuring');
    }
  };

  const isResultReady = status === 'result-ready' && resultUrl;

  return (
    <EditorShell
      title="Remove background"
      creditCost={1}
      status={status}
      onBack={onClose}
      primaryAction={{
        label: isResultReady ? 'Keep result' : 'Remove background · 1 credit',
        onClick: isResultReady ? () => onAccept(resultUrl) : () => void handleRemoveBg(),
        disabled: status === 'processing',
        loading: status === 'processing',
      }}
      secondaryAction={
        isResultReady
          ? { label: 'Try again', onClick: () => { setResultUrl(null); setStatus('configuring'); } }
          : undefined
      }
      error={error}
      sidebar={
        isResultReady
          ? <RemoveBgResultPanel bgMode={bgMode} onBgModeChange={setBgMode} customColor={customColor} onCustomColorChange={setCustomColor} />
          : <RemoveBgSettingsPanel bgMode={bgMode} onBgModeChange={setBgMode} customColor={customColor} onCustomColorChange={setCustomColor} />
      }
    >
      <div className="flex h-full items-center justify-center p-4">
        <div className="relative max-h-full max-w-full overflow-hidden rounded-xl border border-white/10">
          {/* Background layer */}
          <div
            className="absolute inset-0"
            style={isResultReady ? bgStyle(bgMode, customColor) : { background: '#0f172a' }}
          />
          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isResultReady ? resultUrl : imageUrl}
            alt={isResultReady ? 'Background removed' : 'Original'}
            className="relative max-h-[70vh] object-contain"
            crossOrigin="anonymous"
            draggable={false}
          />
          <ProcessingOverlay
            visible={status === 'processing'}
            message="Removing background..."
            submessage="This usually takes 5–10 seconds"
          />
        </div>
      </div>
    </EditorShell>
  );
}
