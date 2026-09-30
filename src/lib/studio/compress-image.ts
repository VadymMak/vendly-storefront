/**
 * Client-side image compression before upload.
 *
 * Only touches files that exceed the server upload limit — anything under it is
 * returned untouched, so tools like Upscale / Improve get the full-resolution original.
 *
 * Oversized files are re-encoded, keeping transparency: JPEG sources stay JPEG,
 * everything else (PNG cutouts, logos, WebP…) goes to WebP, which keeps the alpha
 * channel. Dimensions are only reduced as far as needed to get under the limit.
 * On any failure the original file is returned.
 */

// iOS Safari refuses canvases above 16,777,216 px — stay safely below
const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_ATTEMPTS = 6;
const SHRINK_STEP = 0.8;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image decode failed')); };
    img.src = objectUrl;
  });
}

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

export async function compressImage(
  file: File,
  maxBytes = 9 * 1024 * 1024, // safely under the 10 MB server limit
  quality = 0.85,
): Promise<File> {
  if (file.size <= maxBytes) return file;

  try {
    const img = await loadImage(file);
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    // WebP keeps alpha; Safari may not encode WebP and falls back to PNG — handled via blob.type
    const targetType = isJpeg ? 'image/jpeg' : 'image/webp';

    const srcPixels = img.naturalWidth * img.naturalHeight;
    let scale = srcPixels > MAX_CANVAS_PIXELS ? Math.sqrt(MAX_CANVAS_PIXELS / srcPixels) : 1;
    let best: Blob | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, targetType, quality);
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (blob && blob.size <= maxBytes) break;
      scale *= SHRINK_STEP;
    }

    if (!best || best.size >= file.size) return file;
    const type = best.type || targetType;
    return new File([best], file.name.replace(/\.\w+$/, '') + '.' + extFor(type), { type });
  } catch (err) {
    console.error('[compressImage] failed:', err);
    return file;
  }
}
