import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { getOrCreateCredits } from '@/lib/credits';
import { fetchAllowedImage, SafeFetchError, MAX_INPUT_PIXELS } from '@/lib/studio/safe-fetch';

export const maxDuration = 30;

const MAX_DIMENSION = 8192;

function isValidDimension(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_DIMENSION;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { resultUrl?: string; originalWidth?: unknown; originalHeight?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { resultUrl, originalWidth, originalHeight } = body;

  if (typeof resultUrl !== 'string' || !resultUrl) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  if (!isValidDimension(originalWidth) || !isValidDimension(originalHeight)) {
    return NextResponse.json(
      { error: `Width and height must be integers between 1 and ${MAX_DIMENSION}` },
      { status: 400 },
    );
  }

  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType ?? 'free') as keyof typeof RATE_LIMITS.imageTools;
  const rateLimit = RATE_LIMITS.imageTools[planType] ?? RATE_LIMITS.imageTools.free;

  if (!(await checkRateLimitWithBypass(`image-tools:${ip}:${session.user.id}`, rateLimit, session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const inputBuffer = await fetchAllowedImage(resultUrl);

    const input = sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS });
    const { hasAlpha } = await input.metadata();
    const resizedPipeline = input.resize(originalWidth, originalHeight, {
      fit: 'fill',
      kernel: 'lanczos3',
    });

    const [resized, ext, contentType] = hasAlpha
      ? [await resizedPipeline.png({ compressionLevel: 8 }).toBuffer(), 'png', 'image/png'] as const
      : [await resizedPipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer(), 'jpg', 'image/jpeg'] as const;

    const blob = await put(
      `studio/resize/${session.user.id}/${Date.now()}.${ext}`,
      resized,
      { access: 'public', contentType },
    );

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[studio/resize-to-original]', err);
    return NextResponse.json({ error: 'Resize failed' }, { status: 500 });
  }
}
