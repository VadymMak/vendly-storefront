'use client';

import { useState, useRef } from 'react';

interface Props {
  onImageSelected: (url: string) => void;
  currentImage?: string;
  onClear: () => void;
}

async function compressImage(file: File, maxSize: number, quality: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize);
          width = maxSize;
        } else {
          width = Math.round((width / height) * maxSize);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

export function MobileMediaPicker({ onImageSelected, currentImage, onClear }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 2048, 0.85);
      const fd = new FormData();
      fd.append('image', compressed);
      const res = await fetch('/api/studio/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { url: string };
      onImageSelected(data.url);
    } catch {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  if (currentImage) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        <img src={currentImage} alt="Reference" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
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
          Take Photo
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
          From Gallery
        </button>
      </div>
      {uploading && <p className="text-center text-xs text-gray-500">Uploading...</p>}
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
