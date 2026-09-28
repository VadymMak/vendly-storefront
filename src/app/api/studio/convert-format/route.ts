import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { getOrCreateCredits } from '@/lib/credits';
import { fetchAllowedImage, SafeFetchError, MAX_INPUT_PIXELS } from '@/lib/studio/safe-fetch';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { imageUrl?: string; format?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imageUrl, format } = body;

  if (typeof imageUrl !== 'string' || !imageUrl || !['png', 'jpg', 'webp'].includes(format ?? '')) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType ?? 'free') as keyof typeof RATE_LIMITS.imageTools;
  const rateLimit = RATE_LIMITS.imageTools[planType] ?? RATE_LIMITS.imageTools.free;

  if (!(await checkRateLimitWithBypass(`image-tools:${ip}:${session.user.id}`, rateLimit, session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let buffer: Buffer;
  let contentType: string;
  let ext: string;

  try {
    const inputBuffer = await fetchAllowedImage(imageUrl);
    const pipeline = sharp(inputBuffer, { limitInputPixels: MAX_INPUT_PIXELS });

    switch (format) {
      case 'jpg':
        buffer = await pipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
        contentType = 'image/jpeg';
        ext = 'jpg';
        break;
      case 'webp':
        buffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
        contentType = 'image/webp';
        ext = 'webp';
        break;
      case 'png':
      default:
        buffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
        contentType = 'image/png';
        ext = 'png';
        break;
    }
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[studio/convert-format]', err);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="vendshop-studio.${ext}"`,
      'Content-Length': buffer.length.toString(),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
