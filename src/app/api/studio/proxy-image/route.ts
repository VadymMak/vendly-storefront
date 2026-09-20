import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const download = request.nextUrl.searchParams.get('download');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Relative paths and MOCK mode: redirect to same-origin URL directly
  if (url.startsWith('/') || process.env.STUDIO_MOCK === 'true') {
    return NextResponse.redirect(new URL(url, request.url).toString());
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
    // Kling video CDN
    'klingai.com',
    'aliyuncs.com',
    'cloudfront.net',
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
    });

    if (!response.ok) {
      console.error(`[proxy-image] Upstream ${response.status} for ${parsedUrl.hostname}${parsedUrl.pathname.slice(0, 50)}`);
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentLength = response.headers.get('Content-Length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    };
    if (download) headers['Content-Disposition'] = `attachment; filename="${download.replace(/"/g, '')}"`;

    // Stream video files and files >5 MB to avoid buffering-induced 502 timeouts
    const isLarge = contentType.startsWith('video/') ||
      (contentLength ? parseInt(contentLength, 10) > 5_000_000 : false);

    if (isLarge && response.body) {
      if (contentLength) headers['Content-Length'] = contentLength;
      return new NextResponse(response.body, { headers });
    }

    const buffer = await response.arrayBuffer();
    headers['Content-Length'] = String(buffer.byteLength);
    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('[proxy-image] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 502 });
  }
}
