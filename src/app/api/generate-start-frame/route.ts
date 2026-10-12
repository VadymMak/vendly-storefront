import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { createJob } from '@/lib/studio-jobs';
import { consumeCredits, refundCredits, getOrCreateCredits } from '@/lib/credits';
import { CREDIT_COSTS } from '@/lib/constants';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';

const schema = z.object({
  prompt:      z.string().min(1),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']),
});

const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (body.detail as string) ?? '';
    const m = detail.match(/(\d+(?:\.\d+)?)\s*second/i);
    await new Promise((r) => setTimeout(r, m ? Math.ceil(parseFloat(m[1])) * 1000 : 8000));
    attempt++;
  }
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
  urls?: { get: string };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = schema.parse(await request.json());

  // 1 image credit per start frame (BYOK users with their own Replicate key: no charge).
  // The per-plan rate limit stays as an extra layer against bursts.
  const credits   = await getOrCreateCredits(session.user.id);
  const planType  = (credits.planType || 'free') as keyof typeof RATE_LIMITS.generateImage;
  const rateLimit = RATE_LIMITS.generateImage[planType] ?? RATE_LIMITS.generateImage.free;
  if (!(await checkRateLimitWithBypass(`start-frame:${session.user.id}`, rateLimit, session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!replicateKey) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });

  // Reserve the credit atomically BEFORE the paid call — only when the platform key pays.
  // Superusers pass through consumeCredits without a deduction.
  const userId = session.user.id;
  const cost = CREDIT_COSTS.startFrame;
  const consume = keyRecord
    ? null
    : await consumeCredits(userId, 'image', cost);
  if (consume && !consume.success) {
    return NextResponse.json(
      { error: consume.reason ?? 'Not enough image credits', needsUpgrade: true, creditsRequired: cost, creditType: 'image' },
      { status: 402 },
    );
  }
  const charged = Boolean(consume?.success && !consume.byok && (consume.fromBonus || consume.fromMonthly));
  const refund = async () => {
    if (charged && consume) await refundCredits(userId, 'image', consume.fromBonus ?? 0, consume.fromMonthly ?? 0);
  };

  // Prefer:wait — Replicate holds until Flux completes (~3-6s, well within 60s)
  let createRes: Response;
  try {
    createRes = await fetchWithRetry('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${replicateKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt:              body.prompt,
          aspect_ratio:        body.aspectRatio,
          num_outputs:         1,
          output_format:       'webp',
          go_fast:             true,
          num_inference_steps: 4,
        },
      }),
    });
  } catch (err) {
    await refund();
    console.error('[generate-start-frame] Replicate request failed:', err);
    return NextResponse.json({ error: 'Frame generation failed' }, { status: 502 });
  }

  if (!createRes.ok) {
    await refund();
    const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json({ error: `Replicate error: ${JSON.stringify(err)}` }, { status: 502 });
  }

  const prediction = await createRes.json() as ReplicatePrediction;

  if (prediction.status === 'succeeded') {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ url });
  }

  if (prediction.status === 'failed') {
    await refund();
    return NextResponse.json({ error: prediction.error ?? 'Frame generation failed' }, { status: 502 });
  }

  // Rare: Prefer:wait timed out on Replicate side — fall back to async job
  // The credit stays reserved; refreshJobStatus refunds it if this job fails
  let jobId: string;
  try {
    jobId = await createJob({
      userId,
      predictionId:   prediction.id,
      type:           'image',
      creditType:     charged ? 'image' : undefined,
      creditAmount:   charged ? cost : 0,
      creditDeducted: charged,
      metadata: {
        prompt: body.prompt,
        type:   'start-frame',
        ...(charged && consume && { reserved: { fromBonus: consume.fromBonus ?? 0, fromMonthly: consume.fromMonthly ?? 0 } }),
      },
    });
  } catch (err) {
    await refund();
    throw err;
  }

  return NextResponse.json({ jobId, async: true });
}
