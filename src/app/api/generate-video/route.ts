import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { checkCredits, getOrCreateCredits, getVideoCreditCost } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { createJob } from '@/lib/studio-jobs';
import { getVideoProvider, VideoProviderError } from '@/lib/video';

const generateSchema = z.object({
  prompt:          z.string().min(1),
  skillId:         z.string(),
  aspectRatio:     z.enum(['9:16', '1:1', '16:9']),
  duration:        z.union([z.literal(5), z.literal(10)]),
  startImage:      z.string().url(),
  referenceImages: z.array(z.string().url()).optional(),
});

const IS_MOCK = process.env.STUDIO_MOCK === 'true';

export async function POST(request: Request) {
  // ── Parse body (honeypot must come before auth) ───────────────────────────
  let rawBody: Record<string, unknown>;
  try {
    rawBody = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Honeypot — silent reject ──────────────────────────────────────────────
  if (rawBody.website) {
    return NextResponse.json({ success: true });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = generateSchema.parse(rawBody);

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip       = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`vid:${ip}:${session.user.id}`, RATE_LIMITS.generateVideo[planType], session.user.id))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Spam check ────────────────────────────────────────────────────────────
  if (isAbusivePrompt(body.prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  // ── Credit check (still required — deduction happens later in job polling) ─
  const creditAmount = getVideoCreditCost(body.duration);
  const creditCheck  = await checkCredits(session.user.id, 'video', creditAmount);
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.reason, needsUpgrade: true },
      { status: 403 },
    );
  }

  // Mock mode — return placeholder video without calling the video provider
  if (IS_MOCK) {
    return NextResponse.json({
      success: true,
      jobId: `mock-job-${Date.now()}`,
      message: '[MOCK] Video generation skipped — STUDIO_MOCK=true',
    });
  }

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!replicateKey) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });

  // ── Create prediction — returns immediately, polled via the job record ────
  let prediction;
  try {
    prediction = await getVideoProvider().createVideo({
      prompt:          body.prompt,
      startImage:      body.startImage,
      aspectRatio:     body.aspectRatio,
      duration:        body.duration,
      referenceImages: body.referenceImages,
    }, replicateKey);
  } catch (error) {
    if (error instanceof VideoProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error ?? 'Generation failed' }, { status: 500 });
  }

  // ── Persist job — credit deduction happens in refreshJobStatus on success ─
  const jobId = await createJob({
    userId:       session.user.id,
    predictionId: prediction.predictionId,
    type:         'video',
    creditType:   creditCheck.byok ? undefined : 'video',
    creditAmount: creditCheck.byok ? 0 : creditAmount,
    metadata: {
      prompt:      body.prompt,
      skillId:     body.skillId,
      aspectRatio: body.aspectRatio,
      duration:    body.duration,
    },
  });

  return NextResponse.json({ jobId, predictionId: prediction.predictionId });
}
