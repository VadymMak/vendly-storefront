import { NextRequest, NextResponse } from 'next/server';
import { put } from '@/lib/storage';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { createFinishedJob } from '@/lib/studio-jobs';
import { MAX_INPUT_PIXELS } from '@/lib/studio/safe-fetch';

export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Save a finished Place Products composite ("Save as is" — free) and record it in
 * My Work. Separate from /api/studio/upload, whose files are inputs, not results.
 */
export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const credits   = await getOrCreateCredits(userId);
  const planType  = (credits.planType ?? 'free') as keyof typeof RATE_LIMITS.imageTools;
  const rateLimit = RATE_LIMITS.imageTools[planType] ?? RATE_LIMITS.imageTools.free;
  if (!(await checkRateLimitWithBypass(`save-composite:${userId}`, rateLimit, userId))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let file: File | null;
  let sourceUrl: string | null = null;
  try {
    const form = await req.formData();
    file = form.get('image') as File | null;
    // Set when this is an improved version of an earlier composite (gallery links them)
    const rawSource = form.get('sourceUrl');
    if (typeof rawSource === 'string' && rawSource.startsWith('https://') && rawSource.length <= 2048) sourceUrl = rawSource;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 });
  }

  // Re-encode: only real images get stored, whatever the client claims the file is
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: MAX_INPUT_PIXELS })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
  }

  try {
    const blob = await put(`studio/place-products/${userId}/${Date.now()}.png`, png, {
      access: 'public',
      contentType: 'image/png',
    });
    await createFinishedJob({
      userId,
      type:         'place-products',
      outputUrl:    blob.url,
      creditAmount: 0,
      metadata:     sourceUrl ? { blended: false, improved: true, sourceUrl } : { blended: false },
    }).catch((err) => console.error('[save-composite] Failed to save to StudioJob:', err));
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[save-composite]', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
