'use client';

import { useState } from 'react';
import { MOTION_PRESETS, SIZE_PRESETS, type MotionPresetId } from '@/lib/studio/constants';
import type { EditorStatus } from '@/lib/types';
import { EditorShell } from './shared/EditorShell';
import { ProcessingOverlay } from './shared/ProcessingOverlay';

interface AnimateEditorProps {
  imageUrl: string;
  onAccept: (videoUrl: string, prompt: string) => void;
  onClose: () => void;
  selectedSize: string;
  hasVideoCredits: boolean;
  onNeedCredits: () => void;
}

async function fetchFileFromUrl(url: string, filename: string): Promise<File> {
  const blob = await fetch(url).then(r => r.blob());
  return new File([blob], filename, { type: blob.type || 'image/webp' });
}

async function uploadToStorage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data.url!;
}

async function getPublicUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const file = await fetchFileFromUrl(url, `studio-${Date.now()}.webp`);
  return uploadToStorage(file);
}

async function pollJob(jobId: string, timeoutMs = 600_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const res = await fetch(`/api/studio/job/${jobId}`);
    const data = await res.json() as { status: string; outputUrl?: string; error?: string };
    if (data.status === 'succeeded' && data.outputUrl) return data.outputUrl;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error ?? `Job ${data.status}`);
    }
  }
  throw new Error('Video generation timed out');
}

function toVideoAspectRatio(ar: string): '9:16' | '1:1' | '16:9' {
  if (ar === '9:16' || ar === '4:5') return '9:16';
  if (ar === '1:1') return '1:1';
  return '16:9';
}

function AnimateSettingsPanel({
  selectedMotion,
  onMotionChange,
  duration,
  onDurationChange,
  customPrompt,
  onCustomPromptChange,
}: {
  selectedMotion: MotionPresetId;
  onMotionChange: (id: MotionPresetId) => void;
  duration: 5 | 10;
  onDurationChange: (d: 5 | 10) => void;
  customPrompt: string;
  onCustomPromptChange: (s: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-300">Motion style</p>
        <div className="space-y-1.5">
          {MOTION_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => onMotionChange(preset.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                selectedMotion === preset.id
                  ? 'border-green-500/50 bg-green-500/10 text-white'
                  : 'border-white/10 text-gray-300 hover:border-green-500/30 hover:bg-green-500/5'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-gray-500">Or describe motion:</p>
        <textarea
          value={customPrompt}
          onChange={e => onCustomPromptChange(e.target.value)}
          placeholder="Slow zoom in with steam rising..."
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/30"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-300">Duration</p>
        <div className="flex gap-2">
          {([5, 10] as const).map(d => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                duration === d
                  ? 'border-green-500/40 bg-green-500/10 text-white'
                  : 'border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {d} sec
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="text-xs text-gray-500">
          AI video generation creates realistic motion from your image.
          Processing takes 30–60 seconds. Each video costs 5 credits.
        </p>
      </div>
    </div>
  );
}

function AnimateResultPanel({
  duration,
  motionLabel,
}: {
  duration: number;
  motionLabel: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-300">Video info</p>
      <div className="space-y-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-gray-500">Motion</p>
          <p className="text-sm font-medium text-white">{motionLabel}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-medium text-white">{duration} seconds</p>
        </div>
      </div>
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
        <p className="text-xs text-green-400">
          Video generated! Preview it above, then keep or try again with different settings.
        </p>
      </div>
    </div>
  );
}

export function AnimateEditor({
  imageUrl,
  onAccept,
  onClose,
  selectedSize,
  hasVideoCredits,
  onNeedCredits,
}: AnimateEditorProps) {
  const [status, setStatus] = useState<EditorStatus>('configuring');
  const [selectedMotion, setSelectedMotion] = useState<MotionPresetId>('cinematic');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [customPrompt, setCustomPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedPrompt, setUsedPrompt] = useState('');

  const handleAnimate = async () => {
    if (!hasVideoCredits) {
      onNeedCredits();
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const publicUrl = await getPublicUrl(imageUrl);
      const motionPreset = MOTION_PRESETS.find(p => p.id === selectedMotion);
      const finalPrompt = customPrompt.trim() || motionPreset?.prompt || 'Subtle cinematic motion';
      setUsedPrompt(finalPrompt);

      const aspectRatio = toVideoAspectRatio(
        SIZE_PRESETS.find(s => s.id === selectedSize)?.aspect_ratio ?? '16:9',
      );

      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:      finalPrompt,
          skillId:     'cinematic',
          aspectRatio,
          duration,
          startImage:  publicUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string; needsUpgrade?: boolean };
        throw new Error(data.error ?? 'Video generation failed');
      }
      const data = await res.json() as { jobId: string };
      const resultVideoUrl = await pollJob(data.jobId);

      setVideoUrl(resultVideoUrl);
      setStatus('result-ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Video generation failed');
      setStatus('configuring');
    }
  };

  const isResultReady = status === 'result-ready' && videoUrl;
  const motionLabel = MOTION_PRESETS.find(p => p.id === selectedMotion)?.label ?? 'Custom';

  return (
    <EditorShell
      title="Animate image"
      creditCost={5}
      status={status}
      onBack={onClose}
      primaryAction={{
        label: isResultReady ? 'Keep result' : 'Create video · 5 credits',
        onClick: isResultReady ? () => onAccept(videoUrl, usedPrompt) : () => void handleAnimate(),
        disabled: status === 'processing',
        loading: status === 'processing',
      }}
      secondaryAction={
        isResultReady
          ? {
              label: 'Try again',
              onClick: () => {
                setVideoUrl(null);
                setStatus('configuring');
              },
            }
          : undefined
      }
      error={error}
      sidebar={
        isResultReady
          ? <AnimateResultPanel duration={duration} motionLabel={motionLabel} />
          : (
            <AnimateSettingsPanel
              selectedMotion={selectedMotion}
              onMotionChange={setSelectedMotion}
              duration={duration}
              onDurationChange={setDuration}
              customPrompt={customPrompt}
              onCustomPromptChange={setCustomPrompt}
            />
          )
      }
    >
      <div className="flex h-full items-center justify-center p-4">
        {isResultReady ? (
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={videoUrl}
              autoPlay
              loop
              playsInline
              muted
              controls
              className="max-h-[70vh] rounded-xl border border-white/10"
              style={{ background: '#000' }}
            />
          </div>
        ) : (
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Source image"
              className="max-h-[70vh] rounded-xl border border-white/10 object-contain"
              crossOrigin="anonymous"
              draggable={false}
            />
            <ProcessingOverlay
              visible={status === 'processing'}
              message="Generating video..."
              submessage="This can take 30–60 seconds"
            />
          </div>
        )}
      </div>
    </EditorShell>
  );
}
