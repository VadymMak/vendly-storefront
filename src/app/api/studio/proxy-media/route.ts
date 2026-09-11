import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });

    const blob = await res.blob();
    const headers = new Headers();
    headers.set('Content-Type', blob.type || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(blob, { headers });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
