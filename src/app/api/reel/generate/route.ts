import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { photos, mode, cta1, cta2, musicTrackId } = body;

    const response = await fetch(`${REEL_SERVICE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, mode, cta1, cta2, userId: session.user.id, musicTrackId: musicTrackId || 'warm-cafe' }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reel/generate] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    // reel-service only returns jobs owned by this user
    const response = await fetch(
      `${REEL_SERVICE_URL}/generate/status/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(session.user.id)}`,
    );
    const data = await response.json();

    // reel-service listens on 127.0.0.1 only — the browser gets the reel through /api/reel/video
    if (data.result?.videoUrl) {
      data.result.videoUrl = `/api/reel/video/${encodeURIComponent(jobId)}`;
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
