import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SAFE_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'application/octet-stream',
]);

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get('url');
  const download = request.nextUrl.searchParams.get('download');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow same-origin relative paths (never protocol-relative //evil.com)
  if (url.startsWith('/') && !url.startsWith('//')) {
    if (process.env.STUDIO_MOCK === 'true') {
      return NextResponse.redirect(new URL(url, request.url).toString());
    }
    return NextResponse.json({ error: 'Relative paths not allowed' }, { status: 403 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS allowed' }, { status: 403 });
  }

  const allowed = [
    'vercel-storage.com',
    'replicate.delivery',
    'replicate.com',
    'fal.media',
    'fal.ai',
    'x.ai',
    'xai.com',
    'oaidalleapiprodscus.blob.core.windows.net',
    'commondatastorage.googleapis.com',
    'klingai.com',
    'bfl.ai',
  ];

  // exact match OR subdomain match (e.g. imgen.x.ai matches x.ai)
  const isAllowed = allowed.some((d) => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d));
  if (!isAllowed) {
    console.error(`[proxy-image] Blocked domain: ${parsedUrl.hostname}`);
    return NextResponse.json({ error: `Domain not allowed: ${parsedUrl.hostname}` }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'image/*,video/*,*/*' },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: 'Redirects not followed' }, { status: 403 });
    }

    if (!response.ok) {
      console.error(`[proxy-image] Upstream ${response.status} for ${parsedUrl.hostname}${parsedUrl.pathname.slice(0, 50)}`);
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status },
      );
    }

    const rawContentType = (response.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    if (!SAFE_CONTENT_TYPES.has(rawContentType)) {
      console.error(`[proxy-image] Blocked unsafe Content-Type: ${rawContentType}`);
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 403 });
    }

    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const headers: Record<string, string> = {
      'Content-Type':           rawContentType,
      'Cache-Control':          'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };
    if (download) headers['Content-Disposition'] = `attachment; filename="${download.replace(/[^a-zA-Z0-9._-]/g, '_')}"`;

    // Stream video files and files >5 MB to avoid buffering-induced 502 timeouts
    const isLarge = rawContentType.startsWith('video/') ||
      (contentLength ? parseInt(contentLength, 10) > 5_000_000 : false);

    if (isLarge && response.body) {
      if (contentLength) headers['Content-Length'] = contentLength;
      return new NextResponse(response.body, { headers });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    headers['Content-Length'] = String(buffer.byteLength);
    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('[proxy-image] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 502 });
  }
}
