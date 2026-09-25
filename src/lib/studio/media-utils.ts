const MAX_DATA_URL_SIZE = 4 * 1024 * 1024; // 4MB — stay under sessionStorage limit

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasFallback(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/webp', 0.85)); }
      catch { reject(new Error('Canvas tainted')); }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;

  let blob: Blob | null = null;

  // Try 1: Direct fetch (same-origin or CORS-enabled)
  try {
    const res = await fetch(url);
    if (res.ok) blob = await res.blob();
  } catch {
    // CORS or network error — fall through to proxy
  }

  // Try 2: Server-side proxy (bypasses CORS)
  if (!blob) {
    try {
      const proxyUrl = `/api/studio/proxy-media?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) blob = await res.blob();
    } catch {
      console.warn('[media-utils] Proxy fetch also failed for:', url);
    }
  }

  if (blob) {
    if (blob.size > MAX_DATA_URL_SIZE) {
      console.warn(`[media-utils] File too large for data URL (${(blob.size / 1024 / 1024).toFixed(1)}MB), keeping original URL:`, url);
      return url;
    }
    return fileToDataUrl(new File([blob], 'media', { type: blob.type }));
  }

  // Try 3: Canvas fallback for images only
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url) || url.includes('image')) {
    try {
      return await canvasFallback(url);
    } catch {
      // give up
    }
  }

  console.warn('[media-utils] All conversion methods failed, returning original URL:', url);
  return url;
}

/**
 * Check if a video URL has an audio track.
 * Returns true by default if the browser API is unavailable.
 */
export async function videoHasAudio(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      // @ts-expect-error — audioTracks not in all TS defs
      const tracks = video.audioTracks as { length: number } | undefined;
      resolve(tracks ? tracks.length > 0 : true);
      video.remove();
    };

    video.onerror = () => {
      resolve(false);
      video.remove();
    };

    video.src = url;
  });
}

/**
 * Get video duration in seconds, defaulting to 5 on error.
 */
export async function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 5);
      video.remove();
    };
    video.onerror = () => {
      resolve(5);
      video.remove();
    };
    video.src = url;
  });
}
