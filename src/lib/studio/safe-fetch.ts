/**
 * SSRF-safe fetch for server routes that take an image URL from the client.
 * Same rules as proxy-image / proxy-media: HTTPS only, host allowlist,
 * no redirects, timeout, hard size cap enforced while streaming.
 */

// Hosts our generators and storage return image URLs from (mirrors proxy-image)
export const IMAGE_ALLOWED_HOSTS = [
  'vercel-storage.com',
  'replicate.delivery',
  'replicate.com',
  'fal.media',
  'fal.ai',
  'x.ai',
  'xai.com',
  'oaidalleapiprodscus.blob.core.windows.net',
  'klingai.com',
  'bfl.ai',
];

export const MAX_IMAGE_FETCH_BYTES = 20 * 1024 * 1024; // 20 MB

/** Sharp input pixel cap (~7000×7000) — blocks decompression bombs */
export const MAX_INPUT_PIXELS = 50_000_000;

export class SafeFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return IMAGE_ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h),
  );
}

/** Fetch an image from an allowlisted host into a Buffer, or throw SafeFetchError. */
export async function fetchAllowedImage(
  raw: string,
  maxBytes: number = MAX_IMAGE_FETCH_BYTES,
): Promise<Buffer> {
  if (!isAllowedImageUrl(raw)) {
    throw new SafeFetchError('Image URL not allowed', 403);
  }

  let res: Response;
  try {
    res = await fetch(raw, {
      headers: { Accept: 'image/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new SafeFetchError('Failed to fetch image', 502);
  }

  if (res.status >= 300 && res.status < 400) {
    throw new SafeFetchError('Redirects not followed', 403);
  }
  if (!res.ok || !res.body) {
    throw new SafeFetchError(`Upstream error: ${res.status}`, 502);
  }

  const contentType = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (contentType && contentType !== 'application/octet-stream' &&
      (!contentType.startsWith('image/') || contentType === 'image/svg+xml')) {
    throw new SafeFetchError('Unsupported content type', 415);
  }

  const declared = parseInt(res.headers.get('Content-Length') ?? '0', 10);
  if (declared > maxBytes) {
    throw new SafeFetchError('Image too large', 413);
  }

  // Enforce the cap while streaming — Content-Length can be absent or wrong
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError('Image too large', 413);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
