import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

// Headers passed through so <video> can seek (Range → 206) and download works
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const range = request.headers.get('range');

  try {
    // reel-service checks the job belongs to this user — otherwise 404
    const upstream = await fetch(
      `${REEL_SERVICE_URL}/generate/video/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(session.user.id)}`,
      { headers: range ? { Range: range } : {} },
    );
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Video not found' }, { status: upstream.status === 416 ? 416 : 404 });
    }

    const headers = new Headers({ 'Cache-Control': 'private, max-age=3600' });
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (new URL(request.url).searchParams.has('download')) {
      headers.set('Content-Disposition', 'attachment; filename="reel.mp4"');
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error: unknown) {
    console.error('[reel/video]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Reel service unavailable' }, { status: 503 });
  }
}
