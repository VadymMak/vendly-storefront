import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname } from 'path';
import { Readable } from 'stream';
import { resolveUploadPath } from '@/lib/storage';

// Serves files written by src/lib/storage.ts. vendshop.shop reaches Next.js through the
// Cloudflare tunnel, which caches these responses at the edge (immutable, long max-age).

// Only media types are served — user content is on the app's own origin now
const MIME: Record<string, string> = {
  webp: 'image/webp',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  avif: 'image/avif',
  svg:  'image/svg+xml',
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  m4a:  'audio/mp4',
  ogg:  'audio/ogg',
};

// no-store, so Cloudflare never caches a miss for a file that's written a moment later
function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function baseHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type':                 contentType,
    'Cache-Control':                'public, max-age=31536000, immutable',
    'Accept-Ranges':                'bytes',
    'Access-Control-Allow-Origin':  '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    // A crafted SVG/HTML can't run script on the app origin
    'X-Content-Type-Options':       'nosniff',
    'Content-Security-Policy':      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
}

async function serve(req: Request, segments: string[], headOnly: boolean): Promise<Response> {
  let fullPath: string;
  try {
    fullPath = resolveUploadPath(segments.map((s) => decodeURIComponent(s)).join('/'));
  } catch {
    return notFound();
  }

  const contentType = MIME[extname(fullPath).slice(1).toLowerCase()];
  if (!contentType) return notFound();

  let size: number;
  try {
    const info = await stat(fullPath);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    return notFound();
  }

  const headers = baseHeaders(contentType);

  // Range requests — required for <video> seeking (iOS Safari won't play without them)
  const range = req.headers.get('range');
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start < 0) start = 0;
    if (end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    }
    const partHeaders = { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) };
    if (headOnly) return new Response(null, { status: 206, headers: partHeaders });
    const stream = Readable.toWeb(createReadStream(fullPath, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: 206, headers: partHeaders });
  }

  const fullHeaders = { ...headers, 'Content-Length': String(size) };
  if (headOnly) return new Response(null, { status: 200, headers: fullHeaders });
  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers: fullHeaders });
}

interface Ctx {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: Request, { params }: Ctx) {
  return serve(req, (await params).path, false);
}

export async function HEAD(req: Request, { params }: Ctx) {
  return serve(req, (await params).path, true);
}
