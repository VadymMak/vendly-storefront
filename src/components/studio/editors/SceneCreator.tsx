'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SceneCreatorProps {
  cutoutUrl: string;
  onClose: () => void;
  onResult: (url: string) => void;
  galleryImages?: string[];
}

const ASPECT_RATIOS = [
  { label: 'Square', value: '1:1', icon: '⬜' },
  { label: 'Landscape', value: '3:2', icon: '▬' },
  { label: 'Portrait', value: '2:3', icon: '▮' },
  { label: 'Wide', value: '16:9', icon: '▭' },
  { label: 'Story', value: '9:16', icon: '📱' },
];

const SCENE_PRESETS = [
  { label: 'Restaurant Table', prompt: 'Product placed on an elegant marble table in a warm restaurant setting, soft ambient lighting, shallow depth of field' },
  { label: 'Studio White', prompt: 'Product on clean white surface, professional studio lighting, soft shadows, minimalist' },
  { label: 'Nature', prompt: 'Product placed on natural stone surface outdoors, golden hour sunlight, blurred green foliage background' },
  { label: 'Kitchen', prompt: 'Product on modern kitchen countertop, bright natural light from window, lifestyle photography' },
  { label: 'Luxury', prompt: 'Product on dark marble surface with gold accents, dramatic rim lighting, premium aesthetic' },
  { label: 'Beach', prompt: 'Product on sandy beach surface, ocean waves in background, bright sunny day, tropical vibes' },
];

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function SceneCreator({ cutoutUrl, onClose, onResult, galleryImages = [] }: SceneCreatorProps) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([cutoutUrl]);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  function addImageUrl(url: string) {
    if (images.length >= 5) { setError('Maximum 5 images per scene'); return; }
    if (images.includes(url)) { setError('This image is already added'); return; }
    setImages(prev => [...prev, url]);
    setError(null);
  }

  function removeImage(url: string) {
    if (images.length === 1) return;
    setImages(prev => prev.filter(u => u !== url));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 5) { setError('Maximum 5 images per scene'); return; }

    setIsUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-studio-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      addImageUrl(data.url!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  }

  async function handleCreateScene() {
    if (!prompt.trim() || images.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/studio/scene-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: images, prompt: prompt.trim(), aspectRatio }),
      });

      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Scene composition failed');
      setResult(data.url!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene');
    } finally {
      setIsProcessing(false);
    }
  }

  // Gallery images not yet added to scene (exclude already-added ones)
  const availableGallery = galleryImages.filter(u => !images.includes(u));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[95vw] max-w-5xl overflow-hidden rounded-xl bg-[#1a1a2e]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          <IconX />
        </button>

        {/* Left: Image previews / Result */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6">
          {result ? (
            <>
              <p className="text-xs text-gray-400">Generated Scene</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Generated scene" className="max-h-[70vh] max-w-full rounded-lg shadow-xl" />
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-gray-400">
                {images.length === 1 ? 'Your cutout' : `${images.length} images`}
                <span className="ml-1 text-gray-600">({images.length}/5)</span>
              </p>

              {/* Thumbnails */}
              <div className="flex flex-wrap justify-center gap-3">
                {images.map((url, i) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Image ${i + 1}`}
                      className="h-40 w-40 rounded-lg border border-white/10 bg-black/30 object-contain"
                    />
                    {images.length > 1 && (
                      <button
                        onClick={() => removeImage(url)}
                        className="absolute -right-2 -top-2 hidden items-center justify-center rounded-full bg-red-600 p-1 text-white group-hover:flex"
                      >
                        <IconX size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add image buttons */}
              {images.length < 5 && (
                <div className="flex gap-2">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" />
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      '📁 Upload'
                    )}
                  </button>
                  {availableGallery.length > 0 && (
                    <button
                      onClick={() => setShowGalleryPicker(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:bg-white/5"
                    >
                      🖼 From Gallery
                    </button>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-600">
                Up to 5 images. Grok AI will compose them into one scene.
              </p>
            </>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex w-[320px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#12121f] p-4">
          {result ? (
            <>
              <h3 className="text-sm font-medium text-white">Scene Result</h3>
              <button
                onClick={() => { onResult(result); onClose(); }}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Use Result
              </button>
              <button
                onClick={async () => {
                  const res = await fetch(result);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `scene-${Date.now()}.jpg`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                💾 Save
              </button>
              <button
                onClick={() => {
                  router.push(`/studio/animate?image=${encodeURIComponent(result)}`);
                  onClose();
                }}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                🎬 Animate
              </button>
              <button
                onClick={() => { onResult(result); onClose(); }}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => { setResult(null); setError(null); }}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                Try Again
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-white">Scene Creator</h3>
              <p className="text-[10px] text-gray-500">
                Powered by Grok AI — shadows, lighting, and perspective handled natively. Requires xAI API key in Settings.
              </p>

              {/* Scene presets */}
              <div>
                <label className="text-xs text-gray-400">Quick Scenes</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SCENE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setPrompt(preset.prompt)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        prompt === preset.prompt
                          ? 'border-purple-600/60 bg-purple-600/20 text-purple-300'
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scene description */}
              <div>
                <label className="text-xs text-gray-400">Scene Description</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe where to place the object(s) — surface, environment, lighting, mood..."
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-600/50 focus:outline-none"
                  rows={4}
                />
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="text-xs text-gray-400">Aspect Ratio</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ASPECT_RATIOS.map(ar => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        aspectRatio === ar.value
                          ? 'bg-purple-600 text-white'
                          : 'border border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="mr-1">{ar.icon}</span>
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </p>
              )}

              <button
                onClick={handleCreateScene}
                disabled={isProcessing || !prompt.trim() || images.length === 0}
                className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" />
                    </svg>
                    Creating scene... 15–30 sec
                  </span>
                ) : (
                  '🎬 Create Scene'
                )}
              </button>

              <p className="text-[10px] text-gray-600">
                One AI call — Grok generates shadows, reflections, and lighting natively.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Gallery Picker overlay */}
      {showGalleryPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowGalleryPicker(false)}
        >
          <div
            className="relative w-[90vw] max-w-2xl rounded-xl border border-white/10 bg-[#1a1a2e] p-5"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-medium text-white">Pick from Gallery</h3>
            <p className="mb-4 text-[10px] text-gray-500">
              Click images to add them. Selected: {images.length}/5
            </p>
            <div className="grid max-h-[55vh] grid-cols-4 gap-2 overflow-y-auto">
              {availableGallery.map(url => {
                const selected = images.includes(url);
                return (
                  <button
                    key={url}
                    onClick={() => {
                      if (selected) {
                        removeImage(url);
                      } else {
                        addImageUrl(url);
                      }
                    }}
                    className={`relative overflow-hidden rounded-lg border-2 transition-colors ${
                      selected ? 'border-purple-500' : 'border-transparent hover:border-white/30'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                    {selected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-purple-600/40">
                        <span className="text-xl text-white">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {error && <p className="mr-auto text-xs text-red-400">{error}</p>}
              <button
                onClick={() => { setShowGalleryPicker(false); setError(null); }}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
