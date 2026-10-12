import { put } from '@vercel/blob';
import { fetchAllowedImage } from '@/lib/studio/safe-fetch';

// Provider CDN URLs (Replicate, fal, xAI, BFL) expire after hours/days; StudioJob.outputUrl
// must point at our own Blob storage or gallery thumbnails break.

function extFor(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
}

/** Store image bytes we already hold (e.g. the processed generate output). Returns the Blob URL. */
export async function persistBufferToBlob(buffer: Buffer, contentType: string, prefix: string): Promise<string> {
  const blob = await put(`studio/${prefix}/${Date.now()}-result.${extFor(contentType)}`, buffer, {
    access: 'public',
    contentType,
  });
  return blob.url;
}

/**
 * Download an image from a provider URL and persist it to Vercel Blob.
 * Fetches only from allowlisted image hosts (no redirects, size cap, images only).
 * On any failure (expired URL, non-image, upload error) returns the original URL —
 * a temporary URL is better than none.
 */
export async function persistToBlob(providerUrl: string, prefix: string): Promise<string> {
  if (providerUrl.includes('.blob.vercel-storage.com/')) return providerUrl;
  try {
    const { buffer, contentType } = await fetchAllowedImage(providerUrl);
    return await persistBufferToBlob(buffer, contentType, prefix);
  } catch (err) {
    console.error('[persistToBlob] keeping provider URL —', err instanceof Error ? err.message : err);
    return providerUrl;
  }
}
