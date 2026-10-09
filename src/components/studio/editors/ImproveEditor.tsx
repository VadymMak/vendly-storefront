'use client';

import { useState } from 'react';
import type { EditorStatus, EnhancementIntensity } from '@/lib/types';
import { ENHANCEMENT_PRESETS } from '@/lib/studio/constants';
import { MODEL_CATALOG } from '@/lib/studio/config';
import { EditorShell } from './shared/EditorShell';
import { BeforeAfterSlider } from './shared/BeforeAfterSlider';
import { ProcessingOverlay } from './shared/ProcessingOverlay';

interface ImproveEditorProps {
  imageUrl: string;
  imageFile: File;
  onAccept: (resultUrl: string) => void;
  onClose: () => void;
}

type ImproveStep = 'configuring' | 'processing' | 'enhanced' | 'ai-processing' | 'ai-finished';

const INTENSITY_OPTIONS: { id: EnhancementIntensity; label: string }[] = [
  { id: 'natural',      label: 'Natural' },
  { id: 'professional', label: 'Professional' },
  { id: 'bold',         label: 'Bold' },
];

function ImproveSettingsPanel({
  selectedPreset,
  onPresetChange,
  intensity,
  onIntensityChange,
}: {
  selectedPreset: string | null;
  onPresetChange: (id: string | null) => void;
  intensity: EnhancementIntensity;
  onIntensityChange: (val: EnhancementIntensity) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-300">Intensity</p>
        <div className="grid grid-cols-3 gap-1.5">
          {INTENSITY_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => onIntensityChange(opt.id)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                intensity === opt.id
                  ? 'border-green-500/50 bg-green-500/10 text-white'
                  : 'border-white/10 text-gray-400 hover:border-green-500/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm font-medium text-gray-300">Style</p>
      <div className="grid grid-cols-1 gap-2">
        {ENHANCEMENT_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => onPresetChange(preset.id === selectedPreset ? null : preset.id)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              selectedPreset === preset.id
                ? 'border-green-500/50 bg-green-500/10 text-white'
                : 'border-white/10 text-gray-300 hover:border-green-500/30 hover:bg-green-500/5'
            }`}
          >
            <div className="font-medium">{preset.label}</div>
            <div className="text-xs text-gray-500">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EnhancedSidebar({
  onAiFinish,
  aiProcessing,
}: {
  onAiFinish: () => void;
  aiProcessing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
        <p className="text-sm font-medium text-green-400">✓ Photo enhanced</p>
        <p className="mt-1 text-xs text-gray-400">
          Deterministic color correction applied. No AI was used — your photo composition is 100% preserved.
        </p>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-gray-300">Want more?</p>
        <p className="mt-1 text-xs text-gray-400">
          AI Style uses Grok to add creative polish — professional lighting feel, richer atmosphere. It may slightly reinterpret small visual details.
        </p>
        <button
          onClick={onAiFinish}
          disabled={aiProcessing}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {aiProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
              AI processing...
            </span>
          ) : (
            `✨ AI Style · ${MODEL_CATALOG['edit-grok'].creditCost} credit`
          )}
        </button>
      </div>
    </div>
  );
}

function AiFinishedSidebar({
  onKeepAi,
  onKeepOriginal,
}: {
  onKeepAi: () => void;
  onKeepOriginal: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
        <p className="text-sm font-medium text-purple-400">✨ AI Style applied</p>
        <p className="mt-1 text-xs text-gray-400">
          Grok added creative photographic polish. Compare with the enhanced version.
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <button
          onClick={onKeepAi}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500"
        >
          Keep AI Style
        </button>
        <button
          onClick={onKeepOriginal}
          className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5"
        >
          Keep original enhancement
        </button>
      </div>
    </div>
  );
}

export function ImproveEditor({ imageUrl, imageFile, onAccept, onClose }: ImproveEditorProps) {
  const [step, setStep] = useState<ImproveStep>('configuring');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('professional');
  const [intensity, setIntensity] = useState<EnhancementIntensity>('professional');
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [aiFinishUrl, setAiFinishUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnhance = async () => {
    if (!selectedPreset) {
      setError('Please select a style');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('preset', selectedPreset);
      fd.append('intensity', intensity);

      const res = await fetch('/api/studio/enhance-deterministic', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Enhancement failed');
      }
      const data = await res.json() as { url: string };

      setEnhancedUrl(data.url);
      setStep('enhanced');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enhancement failed');
      setStep('configuring');
    }
  };

  const handleAiFinish = async () => {
    if (!enhancedUrl || !selectedPreset) return;

    const preset = ENHANCEMENT_PRESETS.find(p => p.id === selectedPreset);
    if (!preset) return;

    setStep('ai-processing');
    setError(null);

    try {
      // 1. Get original image dimensions for post-resize
      const img = new Image();
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load original image'));
      });
      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;

      // 2. Send enhanced image to Grok
      const enhancedRes = await fetch(enhancedUrl);
      const enhancedBlob = await enhancedRes.blob();
      const enhancedType = enhancedBlob.type || 'image/jpeg';
      const enhancedFile = new File(
        [enhancedBlob],
        enhancedType === 'image/png' ? 'enhanced.png' : 'enhanced.jpg',
        { type: enhancedType },
      );

      const fd = new FormData();
      fd.append('image', enhancedFile);
      fd.append('prompt', preset.aiFinishPrompt);
      fd.append('modelAlias', 'edit-grok');

      const res = await fetch('/api/studio/edit', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'AI Style failed');
      }
      const data = await res.json() as { url: string };

      // 3. Resize Grok result back to original dimensions
      const resizeRes = await fetch('/api/studio/resize-to-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultUrl: data.url, originalWidth, originalHeight }),
      });

      if (resizeRes.ok) {
        const resizeData = await resizeRes.json() as { url: string };
        setAiFinishUrl(resizeData.url);
      } else {
        console.warn('[ImproveEditor] Resize failed, using Grok output as-is');
        setAiFinishUrl(data.url);
      }

      setStep('ai-finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI Style failed');
      setStep('enhanced');
    }
  };

  const handleAccept = () => {
    if (step === 'ai-finished' && aiFinishUrl) {
      onAccept(aiFinishUrl);
    } else if (enhancedUrl) {
      onAccept(enhancedUrl);
    }
  };

  const handleRetry = () => {
    setEnhancedUrl(null);
    setAiFinishUrl(null);
    setStep('configuring');
  };

  const isConfiguring = step === 'configuring' || step === 'processing';
  const isEnhanced    = step === 'enhanced' || step === 'ai-processing';
  const isAiFinished  = step === 'ai-finished';

  let shellStatus: EditorStatus = 'configuring';
  if (step === 'processing') shellStatus = 'processing';
  if (step === 'enhanced' || step === 'ai-processing' || step === 'ai-finished') shellStatus = 'result-ready';

  return (
    <EditorShell
      title="Improve image"
      creditCost={0}
      status={shellStatus}
      onBack={onClose}
      primaryAction={{
        label: isEnhanced || isAiFinished ? 'Keep result' : 'Improve · Free',
        onClick: isEnhanced || isAiFinished ? handleAccept : () => void handleEnhance(),
        disabled: step === 'processing' || step === 'ai-processing' || (step === 'configuring' && !selectedPreset),
        loading: step === 'processing',
      }}
      secondaryAction={
        isEnhanced || isAiFinished
          ? { label: 'Try another', onClick: handleRetry }
          : undefined
      }
      error={error}
      sidebar={
        isConfiguring ? (
          <ImproveSettingsPanel
            selectedPreset={selectedPreset}
            onPresetChange={setSelectedPreset}
            intensity={intensity}
            onIntensityChange={setIntensity}
          />
        ) : isEnhanced ? (
          <EnhancedSidebar
            onAiFinish={() => void handleAiFinish()}
            aiProcessing={step === 'ai-processing'}
          />
        ) : isAiFinished ? (
          <AiFinishedSidebar
            onKeepAi={handleAccept}
            onKeepOriginal={() => {
              setAiFinishUrl(null);
              setStep('enhanced');
            }}
          />
        ) : undefined
      }
    >
      {(isEnhanced || isAiFinished) && enhancedUrl ? (
        <div className="flex h-full items-center justify-center p-4">
          <BeforeAfterSlider
            beforeUrl={imageUrl}
            afterUrl={isAiFinished && aiFinishUrl ? aiFinishUrl : enhancedUrl}
            beforeLabel="Original"
            afterLabel={isAiFinished ? 'AI Style' : 'Enhanced'}
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
              draggable={false}
            />
            <ProcessingOverlay
              visible={step === 'processing'}
              message="Enhancing your image..."
              submessage="This usually takes 1–2 seconds"
            />
          </div>
        </div>
      )}
    </EditorShell>
  );
}
