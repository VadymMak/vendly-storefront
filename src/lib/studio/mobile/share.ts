/**
 * Download helpers for mobile Studio.
 * External CDNs (imgen.x.ai, bfl.ai) don't send Access-Control-Allow-Origin,
 * so remote images go through /api/studio/proxy-media, which is already whitelisted.
 */

export function proxyUrl(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('/') || url.startsWith('data:')) {
    return url;
  }
  return `/api/studio/proxy-media?url=${encodeURIComponent(url)}`;
}

export function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'webp';
}

/** Save an in-memory blob via a temporary object URL (same-origin, so `download` is honoured). */
export function saveBlob(blob: Blob, filename?: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename ?? `vendshop-${Date.now()}.${extFromMime(blob.type)}`;
  // Attached to the DOM — some mobile browsers ignore clicks on detached anchors
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

export async function downloadImage(imageUrl: string, filename?: string): Promise<boolean> {
  try {
    const res = await fetch(proxyUrl(imageUrl));
    if (!res.ok) throw new Error(`Download fetch failed: ${res.status}`);
    saveBlob(await res.blob(), filename);
    return true;
  } catch {
    window.open(imageUrl, '_blank');
    return false;
  }
}

/**
 * Resolve once the browser has the image cached (or gave up), so a loading view can hand over
 * straight to a ready image instead of a blank / second "loading" state.
 */
export function preloadImage(url: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}
