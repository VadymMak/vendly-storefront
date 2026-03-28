'use client';

import { useRef, useState } from 'react';

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
  single?: boolean; // for logo: single image, round preview
  // i18n text overrides
  textUpload?: string;      // "Nahrať logo" / "Upload"
  textChange?: string;      // "Zmeniť logo" / "Change"
  textUploading?: string;   // "Nahrávam..." / "Uploading..."
  textRemove?: string;      // "Odstrániť" / "Remove"
  textAddPhoto?: string;    // "Pridať foto" / "Add photo"
  textMain?: string;        // "Hlavná" / "Main"
  textError?: string;       // "Nahrávanie zlyhalo" / "Upload failed"
}

export default function ImageUpload({
  images,
  onChange,
  max = 5,
  label = 'Fotky',
  hint,
  single = false,
  textUpload = 'Nahrať logo',
  textChange = 'Zmeniť logo',
  textUploading = 'Nahrávam...',
  textRemove = 'Odstrániť',
  textAddPhoto = 'Pridať foto',
  textMain = 'Hlavná',
  textError = 'Nahrávanie zlyhalo',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length >= max) return;

    setUploading(true);
    setError(null);

    const remaining = max - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    const newUrls: string[] = [];

    for (const file of toUpload) {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || textError);
        break;
      }
      newUrls.push(data.url);
    }

    onChange([...images, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const canAdd = images.length < max;

  // ── Single mode (logo) ──────────────────────────────────────────────
  if (single) {
    const logo = images[0] || null;
    return (
      <div>
        {label && <p className="mb-2 text-sm font-medium text-secondary">{label}</p>}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-primary hover:bg-accent"
          >
            {logo ? (
              <img src={logo} alt="Logo" className="h-full w-full object-cover" />
            ) : uploading ? (
              <Spinner />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 group-hover:text-primary">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              {uploading ? textUploading : logo ? textChange : textUpload}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="ml-3 text-sm text-gray-400 hover:text-red-500"
              >
                {textRemove}
              </button>
            )}
            {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  // ── Multi mode (product images) ─────────────────────────────────────
  return (
    <div>
      {label && <p className="mb-2 text-sm font-medium text-secondary">{label}</p>}

      <div className="flex flex-wrap gap-3">
        {/* Existing images */}
        {images.map((url, idx) => (
          <div key={url} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
              aria-label={textRemove}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
                {textMain}
              </span>
            )}
          </div>
        ))}

        {/* Upload button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 transition-colors hover:border-primary hover:bg-accent hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <Spinner />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-xs">{textAddPhoto}</span>
              </>
            )}
          </button>
        )}
      </div>

      {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" />
    </svg>
  );
}
