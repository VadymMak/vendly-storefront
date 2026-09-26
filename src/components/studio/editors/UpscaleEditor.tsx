'use client';

import { useState, useEffect } from 'react';
import type { EditorStatus } from '@/lib/types';
import { EditorShell } from './shared/EditorShell';
import { BeforeAfterSlider } from './shared/BeforeAfterSlider';
import { ProcessingOverlay } from './shared/ProcessingOverlay';

interface UpscaleEditorProps {
  imageUrl: string;
  imageFile: File;
  onAccept: (resultUrl: string) => void;
  onClose: () => void;
}

function UpscaleInfoPanel({
  originalDimensions,
  resultDimensions,
  status,
}: {
  originalDimensions: { w: number; h: number } | null;
  resultDimensions: { w: number; h: number } | null;
  status: EditorStatus;
}) {
  const scale =
    originalDimensions && resultDimensions
      ? Math.round(resultDimensions.w / originalDimensions.w)
      : null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Resolution</p>

      <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="text-xs text-gray-500">Original</p>
        <p className="text-sm font-medium text-white">
          {originalDimensions
            ? `${originalDimensions.w} × ${originalDimensions.h} px`
            : 'Detecting…'}
        </p>
      </div>

      <div className="flex justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>

      <div className={`space-y-1 rounded-lg border p-3 ${
        status === 'result-ready'
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-white/10 bg-white/[0.02]'
      }`}>
        <p className="text-xs text-gray-500">
          {status === 'result-ready' ? 'Upscaled' : 'Estimated output'}
        </p>
        <p className="text-sm font-medium text-white">
          {status === 'result-ready' && resultDimensions
            ? `${resultDimensions.w} × ${resultDimensions.h} px`
            : originalDimensions
              ? `~${originalDimensions.w * 2} × ${originalDimensions.h * 2} px`
              : 'Calculating…'}
        </p>
        {scale !== null && status === 'result-ready' && (
          <p className="text-xs text-green-400">{scale}× upscale</p>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="text-xs text-gray-500">
          {status === 'result-ready'
            ? 'Drag the slider to compare detail levels between original and upscaled.'
            : 'AI upscaling adds detail and sharpness. Best results with images 512 px or larger.'}
        </p>
      </div>
    </div>
  );
}

export function UpscaleEditor({ imageUrl, imageFile, onAccept, onClose }: UpscaleEditorProps) {
  const [status, setStatus] = useState<EditorStatus>('configuring');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);
  const [resultDimensions, setResultDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setOriginalDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  const handleUpscale = async () => {
    setStatus('processing');
    setError(null);

    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      fd.append('type', 'upscale');

      const res = await fetch('/api/enhance-image', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Upscale failed');
      }
      const data = await res.json() as { url: string };

      console.log('[UpscaleEditor] API returned URL:', data.url?.slice(0, 100));

      const resultImg = new Image();
      resultImg.onload = () => {
        console.log('[UpscaleEditor] Result image loaded, dimensions:', resultImg.naturalWidth, '×', resultImg.naturalHeight);
        setResultDimensions({ w: resultImg.naturalWidth, h: resultImg.naturalHeight });
      };
      resultImg.onerror = (e) => {
        console.error('[UpscaleEditor] Failed to load result image:', data.url?.slice(0, 100), e);
      };
      resultImg.src = data.url;

      setResultUrl(data.url);
      setStatus('result-ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upscale failed');
      setStatus('configuring');
    }
  };

  const isResultReady = status === 'result-ready' && resultUrl;

  return (
    <EditorShell
      title="Upscale image"
      creditCost={1}
      status={status}
      onBack={onClose}
      primaryAction={{
        label: isResultReady ? 'Keep result' : 'Upscale · 1 credit',
        onClick: isResultReady ? () => onAccept(resultUrl) : () => void handleUpscale(),
        disabled: status === 'processing',
        loading: status === 'processing',
      }}
      secondaryAction={
        isResultReady
          ? {
              label: 'Try again',
              onClick: () => {
                setResultUrl(null);
                setResultDimensions(null);
                setStatus('configuring');
              },
            }
          : undefined
      }
      error={error}
      sidebar={
        <UpscaleInfoPanel
          originalDimensions={originalDimensions}
          resultDimensions={resultDimensions}
          status={status}
        />
      }
    >
      {isResultReady ? (
        <div className="flex h-full items-center justify-center p-4">
          <BeforeAfterSlider
            beforeUrl={imageUrl}
            afterUrl={resultUrl}
            beforeLabel="Original"
            afterLabel="Upscaled"
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
              visible={status === 'processing'}
              message="Upscaling your image..."
              submessage="This usually takes 10–20 seconds"
            />
          </div>
        </div>
      )}
    </EditorShell>
  );
}
