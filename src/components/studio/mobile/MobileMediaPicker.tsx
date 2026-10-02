'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { compressImage } from '@/lib/studio/compress-image';
import { preloadImage } from '@/lib/studio/mobile/share';

interface Props {
  onImageSelected: (url: string) => void;
  currentImage?: string;
  onClear: () => void;
}

export function MobileMediaPicker({ onImageSelected, currentImage, onClear }: Props) {
  const t = useTranslations('mobile.media');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local preview of the picked file while it uploads (null if the browser can't render it, e.g. HEIC)
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setLocalPreview(URL.createObjectURL(file));
    console.log('[MediaPicker] file:', file.name, file.type, file.size, 'bytes');
    try {
      const compressed = await compressImage(file);
      console.log('[MediaPicker] compressed:', compressed.name, compressed.type, compressed.size, 'bytes');
      const fd = new FormData();
      fd.append('image', compressed);
      const res = await fetch('/api/studio/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown' })) as { error?: string };
        console.error('[MediaPicker] upload failed:', res.status, body);
        if (res.status === 401) {
          setError(t('sessionExpired'));
          return;
        }
        if (res.status === 400 && body.error?.includes('under')) {
          setError(t('fileTooLarge'));
          return;
        }
        throw new Error(body.error || 'Upload failed');
      }
      const data = await res.json() as { url: string };
      await preloadImage(data.url);
      onImageSelected(data.url);
    } catch (err) {
      console.error('[MediaPicker] error:', err);
      setError(t('uploadFailed'));
    } finally {
      setUploading(false);
      setLocalPreview(null);
    }
  }

  if (currentImage) {
    return (
      <div className="relative h-[240px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
        {/* Same frame as the uploading view; photo is already cached by preloadImage */}
        <img
          src={currentImage}
          alt="Reference"
          className="h-full w-full object-contain"
          style={{ animation: 'fade-in 0.4s ease-out' }}
        />
        <button
          onClick={onClear}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
          aria-label="Remove photo"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]" role="status">
        {localPreview && (
          <img
            src={localPreview}
            alt=""
            onError={() => setLocalPreview(null)}
            className="absolute inset-0 h-full w-full object-contain opacity-30"
          />
        )}
        <div className="relative flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
          <p className="text-sm text-gray-300">{t('uploading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm text-gray-300 active:scale-[0.97] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {t('takePhoto')}
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm text-gray-300 active:scale-[0.97] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {t('fromGallery')}
        </button>
      </div>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f); }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f); }}
      />
    </div>
  );
}
