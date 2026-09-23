import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod/v4';
import { checkCredits, getOrCreateCredits, isSuperuser } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { createJob } from '@/lib/studio-jobs';
import { GrokVideoProvider, VideoProviderError } from '@/lib/video';

const schema = z.object({
  prompt:      z.string().min(1).max(1000),
  duration:    z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('16:9'),
});

const IS_MOCK = process.env.STUDIO_MOCK === 'true';

function getCreditCost(duration: number) {
  return duration === 15 ? 25 : duration === 10 ? 16 : 8;
}

export async function POST(request: Request) {
  let rawBody: Record<string, unknown>;
  try {
    rawBody = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot
  if (rawBody.website) return NextResponse.json({ success: true });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = schema.parse(rawBody);

  // Rate limit
  const ip       = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`vid:${ip}:${session.user.id}`, RATE_LIMITS.generateVideo[planType], session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // Spam check
  if (isAbusivePrompt(body.prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  // Credit check — cost depends on duration
  const creditCost  = getCreditCost(body.duration);
  const creditCheck = await checkCredits(session.user.id, 'video', creditCost);
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
  }

  if (IS_MOCK) {
    return NextResponse.json({ jobId: `mock-job-${Date.now()}` });
  }

  const userIsSuperuser = await isSuperuser(session.user.id);
  const apiKey = process.env.XAI_API_KEY ?? '';

  if (!apiKey && !userIsSuperuser) {
    return NextResponse.json({ error: 'xAI API key not configured' }, { status: 500 });
  }

  try {
    const provider = new GrokVideoProvider();
    const result = await provider.createVideo({
      prompt:      body.prompt,
      duration:    body.duration,
      aspectRatio: body.aspectRatio,
    }, apiKey);

    const jobId = await createJob({
      userId:       session.user.id,
      predictionId: `grok:${result.predictionId}`,
      type:         'video',
      creditType:   'video',
      creditAmount: creditCost,
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    if (err instanceof VideoProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[generate-video-t2v]', err);
    return NextResponse.json({ error: 'Video generation failed' }, { status: 500 });
  }
}
