'use client';

import { useState } from 'react';
import type { EditorStatus } from '@/lib/types';
import { ENHANCEMENT_PRESETS, type EnhancementPresetId } from '@/lib/studio/constants';
import { EditorShell } from './shared/EditorShell';
import { BeforeAfterSlider } from './shared/BeforeAfterSlider';
import { ProcessingOverlay } from './shared/ProcessingOverlay';

interface ImproveEditorProps {
  imageUrl: string;
  imageFile: File;
  onAccept: (resultUrl: string) => void;
  onClose: () => void;
}

function ImproveSettingsPanel({
  selectedPreset,
  onPresetChange,
  customPrompt,
  onCustomPromptChange,
}: {
  selectedPreset: EnhancementPresetId | null;
  onPresetChange: (id: EnhancementPresetId | null) => void;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Choose a style</p>
      <div className="grid grid-cols-1 gap-2">
        {ENHANCEMENT_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => {
              onPresetChange(preset.id === selectedPreset ? null : preset.id);
              onCustomPromptChange('');
            }}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              selectedPreset === preset.id
                ? 'border-green-500/50 bg-green-500/10 text-white'
                : 'border-white/10 text-gray-300 hover:border-green-500/30 hover:bg-green-500/5'
            }`}
          >
            <div className="font-medium">{preset.label}</div>
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <p className="text-xs text-gray-500">Or describe the improvement:</p>
        <textarea
          value={customPrompt}
          onChange={e => {
            onCustomPromptChange(e.target.value);
            if (e.target.value.trim()) onPresetChange(null);
          }}
          placeholder="e.g. warmer lighting, more contrast, sharper details..."
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/30"
        />
      </div>
    </div>
  );
}

export function ImproveEditor({ imageUrl, imageFile, onAccept, onClose }: ImproveEditorProps) {
  const [status, setStatus] = useState<EditorStatus>('configuring');
  const [selectedPreset, setSelectedPreset] = useState<EnhancementPresetId | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImprove = async () => {
    const preset = selectedPreset
      ? ENHANCEMENT_PRESETS.find(p => p.id === selectedPreset)
      : null;
    const enhancePrompt = preset?.prompt ?? customPrompt.trim();

    if (!enhancePrompt) {
      setError('Please select a style or describe the improvement');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('prompt', enhancePrompt);

      const res = await fetch('/api/studio/edit', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Enhancement failed');
      }
      const data = await res.json() as { url: string };

      setResultUrl(data.url);
      setStatus('result-ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed');
      setStatus('configuring');
    }
  };

  const handleRetry = () => {
    setResultUrl(null);
    setStatus('configuring');
  };

  const handleAccept = () => {
    if (resultUrl) onAccept(resultUrl);
  };

  const isConfiguring = status === 'configuring' || status === 'processing';

  return (
    <EditorShell
      title="Improve image"
      creditCost={2}
      status={status}
      onBack={onClose}
      primaryAction={{
        label: status === 'result-ready' ? 'Keep result' : 'Improve · 2 credits',
        onClick: status === 'result-ready' ? handleAccept : () => void handleImprove(),
        disabled:
          status === 'processing' ||
          (status === 'configuring' && !selectedPreset && !customPrompt.trim()),
        loading: status === 'processing',
      }}
      secondaryAction={
        status === 'result-ready'
          ? { label: 'Try another', onClick: handleRetry }
          : undefined
      }
      error={error}
      sidebar={
        isConfiguring ? (
          <ImproveSettingsPanel
            selectedPreset={selectedPreset}
            onPresetChange={setSelectedPreset}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />
        ) : undefined
      }
    >
      {status === 'result-ready' && resultUrl ? (
        <div className="flex h-full items-center justify-center p-4">
          <BeforeAfterSlider
            beforeUrl={imageUrl}
            afterUrl={resultUrl}
            beforeLabel="Original"
            afterLabel="Improved"
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-4">
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Original"
              className="max-h-[70vh] rounded-xl border border-white/10 object-contain"
              crossOrigin="anonymous"
              draggable={false}
            />
            <ProcessingOverlay
              visible={status === 'processing'}
              message="Improving your image..."
              submessage="This usually takes 10–15 seconds"
            />
          </div>
        </div>
      )}
    </EditorShell>
  );
}
