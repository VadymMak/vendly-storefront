import { del, put } from '@vercel/blob';
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
// Upload from this server to Blob runs at ~0.75 MB/s, so a 50 MB clip needs over a minute:
// a short limit only on getting the response headers, a generous one for the whole transfer
const VIDEO_HEADERS_TIMEOUT_MS = 30_000;
const VIDEO_TRANSFER_TIMEOUT_MS = 10 * 60_000;

/** Read a response body into memory, failing as soon as it exceeds `max` bytes. */
async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error(`video larger than ${max} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/**
 * Download a video from a provider URL and persist it to Vercel Blob. Only allowlisted
 * provider hosts, no redirects, video content types, max 100 MB. On any failure returns
 * the original URL. Buffered on purpose: put() with a ReadableStream of unknown length
 * crawled (a 12 MB clip did not finish in 10 min) while put(buffer) took ~14 s.
 */
export async function persistVideoToBlob(providerUrl: string, prefix: string): Promise<string> {
  if (providerUrl.includes('.blob.vercel-storage.com/')) return providerUrl;
  try {
    if (!isAllowedImageUrl(providerUrl)) throw new Error('host not allowed');

    const headersAbort = new AbortController();
    const headersTimer = setTimeout(() => headersAbort.abort(new Error('no response headers in time')), VIDEO_HEADERS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(providerUrl, {
        redirect: 'manual',
        signal: AbortSignal.any([headersAbort.signal, AbortSignal.timeout(VIDEO_TRANSFER_TIMEOUT_MS)]),
      });
    } finally {
      clearTimeout(headersTimer);
    }
    if (!res.ok || !res.body) throw new Error(`fetch failed ${res.status}`);

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() || 'video/mp4';
    if (!contentType.startsWith('video/') && contentType !== 'application/octet-stream') {
      throw new Error(`not a video (${contentType})`);
    }
    const declared = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (declared > MAX_VIDEO_BYTES) throw new Error(`too large (${declared} bytes)`);

    const ext = contentType.includes('webm') ? 'webm' : 'mp4';
    const buffer = await readCapped(res.body, MAX_VIDEO_BYTES);
    const blob = await put(`studio/${prefix}/${Date.now()}-result.${ext}`, buffer, {
      access:      'public',
      contentType: contentType.startsWith('video/') ? contentType : 'video/mp4',
      multipart:   buffer.length > 16 * 1024 * 1024, // parallel parts + retries for big clips
    });
    return blob.url;
  } catch (err) {
    console.error('[persistVideoToBlob] keeping provider URL —', err instanceof Error ? err.message : err);
    return providerUrl;
  }
}

/**
 * Delete temporary input copies (images uploaded only so a provider can fetch them) once the
 * provider call is over. Never throws — a leftover file is better than a failed request.
 */
export async function discardBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (err) {
    console.error('[discardBlobs] could not delete input copies:', err instanceof Error ? err.message : err);
  }
}
