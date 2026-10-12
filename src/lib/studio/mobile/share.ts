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

/** Fetch an image (via the proxy when remote) as a File, e.g. to re-upload it to a tool API. */
export async function fileFromUrl(url: string, baseName = 'image'): Promise<File> {
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], `${baseName}.${extFromMime(blob.type)}`, { type: blob.type || 'image/png' });
}

/** Native share sheet with the image file when supported, otherwise a download. */
export async function shareImage(url: string, title: string): Promise<void> {
  try {
    const file = await fileFromUrl(url, `vendshop-${Date.now()}`);
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  await downloadImage(url);
}
