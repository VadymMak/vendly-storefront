import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ALLOWED_HOSTS = [
  'replicate.delivery',
  'replicate.com',
  'pbxt.replicate.delivery',
  'fal.media',
  'fal.ai',
  'klingai.com',
  'bfl.ai',
  'vercel-storage.com',
];

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

// Only image/*, video/*, audio/* — block text/html, image/svg+xml, etc.
function isSafeContentType(raw: string): boolean {
  const ct = raw.split(';')[0].trim().toLowerCase();
  if (ct === 'image/svg+xml') return false;
  return (
    ct.startsWith('image/') ||
    ct.startsWith('video/') ||
    ct.startsWith('audio/') ||
    ct === 'application/octet-stream'
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 403 });
  }

  const allowed = ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h),
  );
  if (!allowed) {
    console.error(`[proxy-media] Blocked host: ${parsed.hostname}`);
    return NextResponse.json({ error: `Host not allowed: ${parsed.hostname}` }, { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ error: 'Redirects not followed' }, { status: 403 });
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream error: ${upstream.status}` }, { status: 502 });
    }

    const rawCt = upstream.headers.get('Content-Type') || 'application/octet-stream';
    if (!isSafeContentType(rawCt)) {
      console.error(`[proxy-media] Blocked Content-Type: ${rawCt}`);
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 403 });
    }

    const contentType = rawCt.split(';')[0].trim().toLowerCase();
    const contentLength = upstream.headers.get('Content-Length');

    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':              contentType,
        'Content-Length':            String(buffer.byteLength),
        'Content-Disposition':       'attachment',
        'Cache-Control':             'private, max-age=3600',
        'X-Content-Type-Options':    'nosniff',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[proxy-media] Error:', msg);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}
