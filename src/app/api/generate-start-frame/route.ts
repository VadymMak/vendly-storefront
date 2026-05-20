import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';

const schema = z.object({
  prompt:      z.string().min(1),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']),
});

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 2 * 60 * 1000;

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

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  });
  if (!keyRecord) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 400 });

  const replicateKey = decrypt(keyRecord.encryptedKey);

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${replicateKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: body.prompt,
        aspect_ratio: body.aspectRatio,
        num_outputs: 1,
        output_format: 'webp',
        go_fast: true,
        num_inference_steps: 4,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json({ error: `Replicate error: ${JSON.stringify(err)}` }, { status: 502 });
  }

  let prediction = await createRes.json() as ReplicatePrediction;

  // Flux with Prefer: wait usually returns immediately; poll as fallback
  const deadline = Date.now() + TIMEOUT_MS;
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled'
  ) {
    if (Date.now() > deadline) {
      return NextResponse.json({ error: 'Frame generation timed out' }, { status: 504 });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${replicateKey}` },
    });
    if (poll.ok) prediction = await poll.json() as ReplicatePrediction;
  }

  if (prediction.status !== 'succeeded' || !prediction.output) {
    return NextResponse.json({ error: prediction.error ?? 'Frame generation failed' }, { status: 502 });
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  return NextResponse.json({ url });
}
