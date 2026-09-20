import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { checkCredits, getOrCreateCredits, getVideoCreditCost, isSuperuser } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { createJob } from '@/lib/studio-jobs';
import { FalKlingProvider, KlingProvider, KlingDirectProvider, VideoProviderError } from '@/lib/video';

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
  // Don't bind to specific provider — any BYOK key counts for byok_creator bypass
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

  // ── Resolve API keys for video providers ─────────────────────────────────
  const [falKeyRecord, replicateKeyRecord, klingKeyRec, klingSecretRec] = await Promise.all([
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'fal' } },
      select: { encryptedKey: true },
    }),
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
      select: { encryptedKey: true },
    }),
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'kling_key' } },
      select: { encryptedKey: true },
    }),
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'kling_secret' } },
      select: { encryptedKey: true },
    }),
  ]);

  const falKey = falKeyRecord
    ? decrypt(falKeyRecord.encryptedKey)
    : (process.env.FAL_KEY ?? '');
  const replicateKey = replicateKeyRecord
    ? decrypt(replicateKeyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');

  // Superusers MUST use their own BYOK key — never platform key
  const userIsSuperuser = await isSuperuser(session.user.id);
  if (userIsSuperuser && !falKeyRecord && !replicateKeyRecord) {
    return NextResponse.json(
      { error: 'Please add your fal.ai or Replicate API key in Settings → API Keys. Superuser accounts require their own key for video generation.' },
      { status: 403 },
    );
  }

  if (!falKey && !replicateKey) {
    return NextResponse.json({ error: 'No video API key configured' }, { status: 500 });
  }

  const videoReq = {
    prompt:          body.prompt,
    startImage:      body.startImage,
    aspectRatio:     body.aspectRatio,
    duration:        body.duration,
    referenceImages: body.referenceImages,
  };

  // ── Create prediction — fallback chain: fal → Replicate → Kling Direct ──
  let prediction;
  let usedProvider: 'fal' | 'replicate' | 'kling-direct' = 'fal';

  // Step 1: Try fal.ai (primary)
  if (falKey) {
    try {
      const raw = await new FalKlingProvider().createVideo(videoReq, falKey);
      prediction = { ...raw, predictionId: `fal:${raw.predictionId}` };
      usedProvider = 'fal';
    } catch (error) {
      console.warn('[generate-video] fal.ai failed, trying Replicate fallback:', error instanceof Error ? error.message : error);
    }
  }

  // Step 2: Fallback to Replicate
  if (!prediction && replicateKey) {
    try {
      prediction = await new KlingProvider().createVideo(videoReq, replicateKey);
      usedProvider = 'replicate';
    } catch (error) {
      console.warn('[generate-video] Replicate failed, trying Kling Direct:', error instanceof Error ? error.message : error);

      // Step 3: Fallback to Kling Direct
      if (isQuotaError(error) && klingKeyRec && klingSecretRec) {
        const compositeKey = `${decrypt(klingKeyRec.encryptedKey)}:${decrypt(klingSecretRec.encryptedKey)}`;
        const directProvider = new KlingDirectProvider();
        const raw = await directProvider.createVideo(videoReq, compositeKey);
        prediction = { ...raw, predictionId: `kling-direct:${raw.predictionId}` };
        usedProvider = 'kling-direct';
      } else {
        if (error instanceof VideoProviderError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
    }
  }

  if (!prediction) {
    return NextResponse.json({ error: 'No video provider available' }, { status: 500 });
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
      provider:    usedProvider,
    },
  });

  return NextResponse.json({ jobId, predictionId: prediction.predictionId, provider: usedProvider });
}

function isQuotaError(error: unknown): boolean {
  if (error instanceof VideoProviderError) {
    return error.status === 402 || error.status === 429;
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  return msg.includes('quota') || msg.includes('insufficient') || msg.includes('rate limit');
}
