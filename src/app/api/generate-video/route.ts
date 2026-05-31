import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { checkCredits, getOrCreateCredits, getVideoCreditCost } from '@/lib/credits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { createJob } from '@/lib/studio-jobs';

const generateSchema = z.object({
  prompt:      z.string().min(1),
  skillId:     z.string(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']),
  duration:    z.union([z.literal(5), z.literal(10)]),
  startImage:  z.string().url(),
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
}

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

  if (!checkRateLimit(`vid:${ip}:${session.user.id}`, RATE_LIMITS.generateVideo[planType])) {
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

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!replicateKey) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });

  // ── Create prediction — no Prefer:wait, returns prediction.id immediately ─
  const createRes = await fetchWithRetry('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${replicateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt:       body.prompt,
        start_image:  body.startImage,
        aspect_ratio: body.aspectRatio,
        duration:     body.duration,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (err.detail as string) ?? JSON.stringify(err);
    return NextResponse.json({ error: `Replicate error: ${detail}` }, { status: 502 });
  }

  const prediction = await createRes.json() as ReplicatePrediction;

  if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error ?? 'Generation failed' }, { status: 500 });
  }

  // ── Persist job — credit deduction happens in refreshJobStatus on success ─
  const jobId = await createJob({
    userId:       session.user.id,
    predictionId: prediction.id,
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

  return NextResponse.json({ jobId, predictionId: prediction.id });
}
