import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { z } from 'zod/v4';
import { createJob } from '@/lib/studio-jobs';

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

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!replicateKey) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });

  // Prefer:wait — Replicate holds until Flux completes (~3-6s, well within 60s)
  const createRes = await fetchWithRetry('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
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

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json({ error: `Replicate error: ${JSON.stringify(err)}` }, { status: 502 });
  }

  const prediction = await createRes.json() as ReplicatePrediction;

  if (prediction.status === 'succeeded') {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return NextResponse.json({ url });
  }

  if (prediction.status === 'failed') {
    return NextResponse.json({ error: prediction.error ?? 'Frame generation failed' }, { status: 502 });
  }

  // Rare: Prefer:wait timed out on Replicate side — fall back to async job
  const jobId = await createJob({
    userId:       session.user.id,
    predictionId: prediction.id,
    type:         'image',
    metadata:     { prompt: body.prompt, type: 'start-frame' },
  });

  return NextResponse.json({ jobId, async: true });
}
