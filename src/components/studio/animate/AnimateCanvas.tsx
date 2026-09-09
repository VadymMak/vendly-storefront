'use client';

import { useState, useEffect, useRef, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { VideoSkill } from '@/lib/types';
import UpgradeModal from '@/components/studio/UpgradeModal';
import { addToAssemble } from '@/lib/studio/media-context';
import { saveToLibrary } from '@/lib/studio/library-store';
import { PipelineBreadcrumb } from '@/components/studio/PipelineBreadcrumb';

// ── Constants ────────────────────────────────────────────────────────────────

const VIDEO_SKILLS: VideoSkill[] = [
  { id: 'ig-reel',   label: 'Instagram Reel',   aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a creative director for Instagram Reels. Transform the user input into a cinematic, visually engaging video prompt optimized for vertical 9:16 format. Focus on dynamic motion, vibrant colors, trend-forward aesthetics, and hook within the first second. Output ONLY the enhanced prompt, no explanations.' },
  { id: 'ig-story',  label: 'Instagram Story',  aspectRatio: '9:16', duration: 5,  systemPrompt: 'You are a social media content director specializing in Instagram Stories. Transform the user input into a visually compelling 9:16 video prompt with a clear narrative arc fitting 5 seconds. Output ONLY the enhanced prompt.' },
  { id: 'tiktok',    label: 'TikTok',           aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a TikTok creative director. Transform the user input into a viral-optimized 9:16 video prompt with a surprising element. Output ONLY the enhanced prompt.' },
  { id: 'ig-post',   label: 'Instagram Post',   aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are a visual content creator for Instagram feed posts. Transform the user input into a square 1:1 video prompt with polished, editorial aesthetics. Output ONLY the enhanced prompt.' },
  { id: 'yt-shorts', label: 'YouTube Shorts',   aspectRatio: '9:16', duration: 10, systemPrompt: 'You are a YouTube Shorts content strategist. Transform the user input into an engaging 9:16 vertical video prompt for 10 seconds. Output ONLY the enhanced prompt.' },
  { id: 'cinematic', label: 'Cinematic',        aspectRatio: '16:9', duration: 10, systemPrompt: 'You are a cinematic director of photography. Transform the user input into a high-end cinematic video prompt in 16:9 widescreen. Describe lighting, camera movement, depth of field, and mood. Output ONLY the enhanced prompt.' },
  { id: 'product',   label: 'Product Showcase', aspectRatio: '1:1',  duration: 5,  systemPrompt: 'You are an e-commerce video director. Transform the user input into a clean product showcase video prompt in 1:1. Focus on 360° reveal, material texture, subtle motion. Output ONLY the enhanced prompt.' },
];

const CAMERA_PRESETS = [
  { id: 'static',    label: 'Static',    suffix: '' },
  { id: 'zoom-in',   label: 'Zoom In',   suffix: ', camera slowly zooms in' },
  { id: 'zoom-out',  label: 'Zoom Out',  suffix: ', camera slowly zooms out' },
  { id: 'pan-left',  label: 'Pan Left',  suffix: ', camera pans left' },
  { id: 'pan-right', label: 'Pan Right', suffix: ', camera pans right' },
  { id: 'orbit',     label: 'Orbit',     suffix: ', camera orbits around subject' },
] as const;

type GenStep = 'generating-frame' | 'animating' | null;

// ── Icons ────────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props { userId: string; userEmail: string; }

export function AnimateCanvas({ userId: _userId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pre-fill from query params (pipeline from Generate mode)
  const imageParam = searchParams.get('image');
  const promptParam = searchParams.get('prompt');

  // Start frame
  const [startImageUrl, setStartImageUrl] = useState<string | null>(imageParam ?? null);
  const [startImageSource, setStartImageSource] = useState<'from-generate' | 'upload' | null>(
    imageParam ? 'from-generate' : null,
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prompt + skill
  const [motionPrompt, setMotionPrompt] = useState(promptParam ?? '');
  const [selectedSkill, setSelectedSkill] = useState<VideoSkill>(VIDEO_SKILLS[0]);
  const [cameraPreset, setCameraPreset] = useState('static');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Generation state
  const [genStep, setGenStep] = useState<GenStep>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // UI
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [textToVideo, setTextToVideo] = useState(!imageParam);

  const isGenerating = genStep !== null;

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGenerating) { setElapsedSeconds(0); startTimeRef.current = null; return; }
    startTimeRef.current = Date.now();
    const tick = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isGenerating]);

  // ── Upload start frame ───────────────────────────────────────────────────
  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Only image files are supported'); return; }
    setIsUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setStartImageUrl(data.url!);
      setStartImageSource('upload');
      setTextToVideo(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setIsUploading(false); }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function clearStartFrame() {
    setStartImageUrl(null);
    setStartImageSource(null);
    setTextToVideo(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Enhance prompt ────────────────────────────────────────────────────────
  async function handleEnhance() {
    if (!motionPrompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const cameraMotion = CAMERA_PRESETS.find(c => c.id === cameraPreset)?.suffix ?? '';
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: motionPrompt + cameraMotion, skillId: selectedSkill.id }),
      });
      const data = await res.json() as { enhanced?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Enhancement failed');
      if (data.enhanced) setMotionPrompt(data.enhanced);
    } catch (e) { setError(e instanceof Error ? e.message : 'Enhance failed'); }
    finally { setIsEnhancing(false); }
  }

  // ── Poll job ──────────────────────────────────────────────────────────────
  async function pollJob(jobId: string): Promise<{ status: string; outputUrl?: string; error?: string }> {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise<void>(r => setTimeout(r, 4000));
      try {
        const res = await fetch(`/api/studio/job/${jobId}`);
        if (!res.ok) continue;
        const data = await res.json() as { status: string; outputUrl?: string; error?: string };
        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') return data;
      } catch { /* retry on network error */ }
    }
    return { status: 'failed', error: 'Generation timed out after 10 minutes' };
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!motionPrompt.trim() || isGenerating) return;
    if (!textToVideo && !startImageUrl) { setError('Please upload a start frame image'); return; }

    setError(null);
    setVideoUrl(null);

    const cameraMotion = CAMERA_PRESETS.find(c => c.id === cameraPreset)?.suffix ?? '';
    const finalPrompt = motionPrompt + cameraMotion;

    let startImage: string;

    try {
      if (textToVideo) {
        // Step 1: generate start frame
        setGenStep('generating-frame');
        const frameRes = await fetch('/api/generate-start-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: finalPrompt, aspectRatio: selectedSkill.aspectRatio }),
        });
        const frameData = await frameRes.json() as { url?: string; jobId?: string; async?: boolean; error?: string };
        if (!frameRes.ok) { setError(frameData.error ?? 'Start frame generation failed'); setGenStep(null); return; }

        if (frameData.url) {
          startImage = frameData.url;
        } else if (frameData.jobId && frameData.async) {
          const frameJob = await pollJob(frameData.jobId);
          if (frameJob.status !== 'succeeded' || !frameJob.outputUrl) {
            setError(frameJob.error ?? 'Start frame generation failed');
            setGenStep(null);
            return;
          }
          startImage = frameJob.outputUrl;
        } else {
          setError('Start frame generation failed');
          setGenStep(null);
          return;
        }
        setStartImageUrl(startImage);
        setStartImageSource('upload');
      } else {
        startImage = startImageUrl!;
      }

      // Step 2: animate with Kling
      setGenStep('animating');
      const videoRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          skillId: selectedSkill.id,
          aspectRatio: selectedSkill.aspectRatio,
          duration: selectedSkill.duration,
          startImage,
        }),
      });
      const videoData = await videoRes.json() as { jobId?: string; url?: string; error?: string; needsUpgrade?: boolean };
      if (!videoRes.ok) {
        if (videoData.needsUpgrade) { setShowUpgrade(true); setGenStep(null); return; }
        throw new Error(videoData.error ?? 'Video generation failed');
      }

      let resultUrl: string | null = null;
      if (videoData.jobId) {
        const result = await pollJob(videoData.jobId);
        if (result.status === 'succeeded' && result.outputUrl) {
          resultUrl = result.outputUrl;
        } else {
          throw new Error(result.error ?? 'Video generation failed');
        }
      } else if (videoData.url) {
        resultUrl = videoData.url;
      }

      if (resultUrl) {
        setVideoUrl(resultUrl);
        saveToLibrary({ type: 'video', url: resultUrl, prompt: motionPrompt });
        (window as unknown as Record<string, () => void>).__refreshCredits?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenStep(null);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  }

  // ── Add to Assemble ───────────────────────────────────────────────────────
  function handleAddToAssemble() {
    if (!videoUrl) return;
    addToAssemble({
      type: 'video',
      url: videoUrl,
      prompt: motionPrompt,
      duration: selectedSkill.duration,
    });
    router.push('/studio/assemble');
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `studio-video-${Date.now()}.mp4`,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { /* silent */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const genStepLabel = genStep === 'generating-frame'
    ? 'Generating start frame with Flux…'
    : 'Animating with Kling… (~2–5 min)';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Pipeline breadcrumb ────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/5 px-4 py-1.5">
        <PipelineBreadcrumb />
      </div>
      {/* ── Prompt bar ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/10 bg-[#0a0a0f] p-4">
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={motionPrompt}
              onChange={e => setMotionPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the motion… e.g. 'camera slowly zooms in, hair blowing in wind, soft bokeh' (Ctrl+Enter)"
              rows={2}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-white/20"
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !motionPrompt.trim()}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {elapsedSeconds > 0 ? `${elapsedSeconds}s…` : 'Starting…'}
                </span>
              ) : (
                <>
                  <IconSparkle />
                  Animate
                </>
              )}
            </button>
            <button
              onClick={handleEnhance}
              disabled={isEnhancing || !motionPrompt.trim()}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              {isEnhancing ? 'Enhancing…' : '✨ Enhance'}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {/* ── 3-column body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: start frame (300px) */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 p-4 md:flex">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Start Frame</h3>
            {startImageUrl && (
              <button onClick={clearStartFrame} className="text-xs text-gray-500 hover:text-white">
                Change
              </button>
            )}
          </div>

          {startImageUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={startImageUrl} alt="Start frame" className="w-full object-cover" />
              {startImageSource === 'from-generate' && (
                <div className="absolute left-2 top-2 rounded-full bg-green-600/80 px-2 py-0.5 text-xs text-white">
                  From Generate
                </div>
              )}
              <button
                onClick={clearStartFrame}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <IconX />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                isDragOver ? 'border-green-600/50 bg-green-600/5' : 'border-white/10 hover:border-white/20',
              ].join(' ')}
            >
              {isUploading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              ) : (
                <>
                  <IconUpload />
                  <div>
                    <p className="text-sm text-gray-300">Drop image or click</p>
                    <p className="text-xs text-gray-500">PNG · JPG · WebP</p>
                  </div>
                </>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {/* Text-to-video toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={textToVideo}
              onChange={e => {
                setTextToVideo(e.target.checked);
                if (e.target.checked) clearStartFrame();
              }}
              className="h-4 w-4 rounded border-white/20 accent-green-600"
            />
            Text-to-video (generate frame)
          </label>

          <button
            onClick={() => router.push('/studio/generate')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white"
          >
            <IconArrowLeft /> Back to Generate
          </button>
        </div>

        {/* Center: preview */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          {isGenerating && (
            <div className="flex flex-col items-center gap-4 text-center">
              {/* 2-step progress */}
              <div className="flex items-center gap-3">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    genStep === 'generating-frame' || genStep === 'animating'
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-gray-400',
                  ].join(' ')}
                >
                  {genStep === 'animating' ? '✓' : '1'}
                </div>
                <div className="h-px w-12 bg-white/10" />
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    genStep === 'animating' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-400',
                  ].join(' ')}
                >
                  2
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                <div>
                  <p className="font-medium text-white">{genStepLabel}</p>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {genStep === 'animating' ? 'This usually takes 2–5 minutes' : 'Generating image…'}
                  </p>
                </div>
              </div>

              {elapsedSeconds > 0 && (
                <p className="text-xs text-gray-500">
                  Elapsed: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
                </p>
              )}
            </div>
          )}

          {!isGenerating && videoUrl && (
            <div className="flex w-full max-w-2xl flex-col gap-4">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-2xl border border-white/10"
                style={{ maxHeight: '60vh' }}
              />
              {/* Actions */}
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleAddToAssemble}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  <IconLayers /> Add to Assemble →
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <IconDownload /> Download MP4
                </button>
                <button
                  onClick={() => { setVideoUrl(null); handleGenerate(); }}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <IconRefresh /> Generate again
                </button>
              </div>
            </div>
          )}

          {!isGenerating && !videoUrl && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  {startImageUrl ? 'Add a motion prompt and click Animate' : 'Choose a start frame and describe the motion'}
                </p>
                <p className="mt-1 text-sm text-gray-500">Cost: ~$0.30–0.60 per generation</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel (280px) */}
        <aside className="hidden w-[280px] flex-shrink-0 overflow-y-auto border-l border-white/10 bg-[#0d0d14] p-4 lg:block">
          {/* Skill presets */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-gray-400">Platform Preset</label>
            <div className="grid grid-cols-1 gap-1.5">
              {VIDEO_SKILLS.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={[
                    'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    selectedSkill.id === skill.id
                      ? 'border-green-600/60 bg-green-600/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  <div className="font-medium">{skill.label}</div>
                  <div className="text-gray-500">{skill.aspectRatio} · {skill.duration}s</div>
                </button>
              ))}
            </div>
          </div>

          {/* Camera presets */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-gray-400">Camera Motion</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CAMERA_PRESETS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCameraPreset(c.id)}
                  className={[
                    'rounded-lg border py-1.5 text-xs transition-colors',
                    cameraPreset === c.id
                      ? 'border-green-600/60 bg-green-600/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration override */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-gray-400">Duration</label>
            <div className="flex gap-1.5">
              {([5, 10] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedSkill(s => ({ ...s, duration: d }))}
                  className={[
                    'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                    selectedSkill.duration === d
                      ? 'border-green-600/60 bg-green-600/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio override */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">Aspect Ratio</label>
            <div className="flex gap-1.5">
              {(['9:16', '1:1', '16:9'] as const).map(ar => (
                <button
                  key={ar}
                  onClick={() => setSelectedSkill(s => ({ ...s, aspectRatio: ar }))}
                  className={[
                    'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                    selectedSkill.aspectRatio === ar
                      ? 'border-green-600/60 bg-green-600/10 text-white'
                      : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
                  ].join(' ')}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
            💡 Each video costs ~$0.30–0.60. 5s videos generate faster with better quality.
          </div>
        </aside>
      </div>

      {showUpgrade && <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
