import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId, musicTrackId } = await req.json();

  if (!jobId || !musicTrackId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const res = await fetch(`${REEL_SERVICE_URL}/generate/remux`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        musicTrackId,
        userId: session.user.id,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({
      ...data,
      videoUrl: `/api/reel/video/${encodeURIComponent(jobId)}?t=${Date.now()}`,
    });
  } catch (err) {
    console.error('[api/reel/remux] Failed:', err);
    return NextResponse.json({ error: 'Re-mux failed' }, { status: 500 });
  }
}
