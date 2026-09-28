import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { getOrCreateCredits } from '@/lib/credits';
import { enhanceDeterministic } from '@/lib/studio/enhance-pipeline';
import { ENHANCEMENT_PRESETS } from '@/lib/studio/constants';
import type { EnhancementIntensity } from '@/lib/types';

export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // Honeypot
  if (formData.get('website')) return NextResponse.json({ success: true });

  const file      = formData.get('image') as File | null;
  const presetId  = (formData.get('preset') as string | null)?.trim() ?? '';
  const intensity = ((formData.get('intensity') as string | null)?.trim() ?? 'professional') as EnhancementIntensity;

  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType ?? 'free') as keyof typeof RATE_LIMITS.aiEdit;
  const rateLimit = RATE_LIMITS.aiEdit[planType] ?? RATE_LIMITS.aiEdit.free;

  if (!(await checkRateLimitWithBypass(`enhance:${ip}:${session.user.id}`, rateLimit, session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const preset = ENHANCEMENT_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    return NextResponse.json({ error: `Unknown preset: ${presetId}` }, { status: 400 });
  }

  if (!['natural', 'professional', 'bold'].includes(intensity)) {
    return NextResponse.json({ error: `Invalid intensity: ${intensity}` }, { status: 400 });
  }

  const params = preset.params[intensity];

  try {
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    const enhanced = await enhanceDeterministic(inputBuffer, params);

    const blob = await put(
      `studio/enhance/${session.user.id}/${Date.now()}.${enhanced.ext}`,
      enhanced.buffer,
      { access: 'public', contentType: enhanced.contentType },
    );

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[studio/enhance-deterministic]', err);
    return NextResponse.json({ error: 'Enhancement failed. Please try again.' }, { status: 500 });
  }
}
