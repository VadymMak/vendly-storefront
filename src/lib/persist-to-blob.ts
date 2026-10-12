import { put } from '@vercel/blob';
import { fetchAllowedImage, isAllowedImageUrl } from '@/lib/studio/safe-fetch';

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

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // provider clips are 5–50 MB
const VIDEO_FETCH_TIMEOUT_MS = 120_000;

/** Pass-through stream that errors once more than `max` bytes went through. */
function byteLimit(max: number): TransformStream<Uint8Array, Uint8Array> {
  let seen = 0;
  return new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new Error(`video larger than ${max} bytes`));
      else controller.enqueue(chunk);
    },
  });
}

/**
 * Download a video from a provider URL and persist it to Vercel Blob (streamed — the file
 * is never held in memory as a whole). Only allowlisted provider hosts, no redirects,
 * video content types, max 100 MB. On any failure returns the original URL.
 */
export async function persistVideoToBlob(providerUrl: string, prefix: string): Promise<string> {
  if (providerUrl.includes('.blob.vercel-storage.com/')) return providerUrl;
  try {
    if (!isAllowedImageUrl(providerUrl)) throw new Error('host not allowed');

    const res = await fetch(providerUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(VIDEO_FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) throw new Error(`fetch failed ${res.status}`);

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() || 'video/mp4';
    if (!contentType.startsWith('video/') && contentType !== 'application/octet-stream') {
      throw new Error(`not a video (${contentType})`);
    }
    const declared = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (declared > MAX_VIDEO_BYTES) throw new Error(`too large (${declared} bytes)`);

    const ext = contentType.includes('webm') ? 'webm' : 'mp4';
    const blob = await put(`studio/${prefix}/${Date.now()}-result.${ext}`, res.body.pipeThrough(byteLimit(MAX_VIDEO_BYTES)), {
      access:      'public',
      contentType: contentType.startsWith('video/') ? contentType : 'video/mp4',
      multipart:   true,
    });
    return blob.url;
  } catch (err) {
    console.error('[persistVideoToBlob] keeping provider URL —', err instanceof Error ? err.message : err);
    return providerUrl;
  }
}
