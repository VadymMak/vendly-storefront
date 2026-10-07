import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { MAX_REEL_PHOTOS } from '@/lib/studio/mobile/reel';

// reel-service (pm2, 127.0.0.1 only) — it also enforces its own image host allowlist
const REEL_SERVICE_URL = 'http://127.0.0.1:3010/api/score/batch';

interface ScoreImage {
  imageUrl: string;
  imageId: string;
}

function parseImages(body: unknown): ScoreImage[] | null {
  const images = (body as { images?: unknown } | null)?.images;
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_REEL_PHOTOS) return null;
  const valid = images.every((img: unknown) => {
    const { imageUrl, imageId } = (img ?? {}) as Record<string, unknown>;
    return typeof imageUrl === 'string' && imageUrl.startsWith('https://') && imageUrl.length <= 2048
      && typeof imageId === 'string' && imageId.length <= 200;
  });
  return valid ? images.map((img: ScoreImage) => ({ imageUrl: img.imageUrl, imageId: img.imageId })) : null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const images = parseImages(await req.json().catch(() => null));
  if (!images) {
    return NextResponse.json({ error: `images: 1-${MAX_REEL_PHOTOS} https URLs required` }, { status: 400 });
  }

  try {
    const response = await fetch(REEL_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
      signal: AbortSignal.timeout(30_000),
    });
    const data: unknown = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    console.error('[reel score]', e);
    return NextResponse.json({ error: 'Quality check unavailable' }, { status: 503 });
  }
}
