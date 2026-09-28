/**
 * Share / download images via proxy to avoid CORS issues.
 * External CDNs (imgen.x.ai, bfl.ai) don't send Access-Control-Allow-Origin,
 * so we route through /api/studio/proxy-media which is already whitelisted.
 */

function proxyUrl(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('/') || url.startsWith('data:')) {
    return url;
  }
  return `/api/studio/proxy-media?url=${encodeURIComponent(url)}`;
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'webp';
}

export async function shareImage(imageUrl: string, title?: string): Promise<boolean> {
  try {
    const res = await fetch(proxyUrl(imageUrl));
    if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
    const blob = await res.blob();
    const ext = extFromMime(blob.type);
    const file = new File([blob], `vendshop-creation.${ext}`, { type: blob.type });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: title ?? 'Created with VendShop Studio',
          files: [file],
        });
        return true;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return false;
        // Share failed — fall through to download
      }
    }
  } catch {
    // Proxy or share failed — fall through to download
  }

  return downloadImage(imageUrl);
}

export async function downloadImage(imageUrl: string, filename?: string): Promise<boolean> {
  try {
    const res = await fetch(proxyUrl(imageUrl));
    if (!res.ok) throw new Error(`Download fetch failed: ${res.status}`);
    const blob = await res.blob();
    const ext = extFromMime(blob.type);
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename ?? `vendshop-${Date.now()}.${ext}`;
    a.click();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch {
    window.open(imageUrl, '_blank');
    return false;
  }
}
