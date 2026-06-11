import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
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
    'oaidalleapiprodscus.blob.core.windows.net',
  ];

  const isAllowed = allowed.some((d) => parsedUrl.hostname.endsWith(d));
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

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[proxy-image] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 502 });
  }
}
