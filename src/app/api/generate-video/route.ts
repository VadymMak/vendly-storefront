import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { checkCredits, deductCredit, getVideoCreditCost } from '@/lib/credits';
import { verifyTurnstile } from '@/lib/turnstile';

const generateSchema = z.object({
  prompt:         z.string().min(1),
  skillId:        z.string(),
  aspectRatio:    z.enum(['9:16', '1:1', '16:9']),
  duration:       z.union([z.literal(5), z.literal(10)]),
  startImage:     z.string().url(),
  turnstileToken: z.string().optional(),
});

const POLL_INTERVAL_MS = 4000;
const TIMEOUT_MS = 5 * 60 * 1000;
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = generateSchema.parse(await request.json());

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  if (!await verifyTurnstile(body.turnstileToken ?? '', ip)) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

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
  });
  if (!keyRecord) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 400 });

  const replicateKey = decrypt(keyRecord.encryptedKey);

  console.log('Kling input:', { prompt: body.prompt, start_image: body.startImage, duration: body.duration, aspect_ratio: body.aspectRatio });

  // kwaivgi/kling-v2.1 is an image-to-video model; `start_image` is the start frame input
  const createRes = await fetchWithRetry('https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${replicateKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt:      body.prompt,
        start_image: body.startImage,
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

  let prediction = await createRes.json() as ReplicatePrediction;

  const deadline = Date.now() + TIMEOUT_MS;
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled'
  ) {
    if (Date.now() > deadline) {
      return NextResponse.json({ error: 'Generation timed out after 5 minutes' }, { status: 504 });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${replicateKey}` },
    });
    if (!pollRes.ok) continue;
    prediction = await pollRes.json() as ReplicatePrediction;
  }

  if (prediction.status !== 'succeeded' || !prediction.output) {
    return NextResponse.json({ error: prediction.error ?? 'Generation failed' }, { status: 502 });
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

  if (!creditCheck.byok) {
    await deductCredit(session.user.id, 'video', creditAmount);
  }

  return NextResponse.json({ url });
}
