import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod/v4';
import { checkCredits, getOrCreateCredits, isSuperuser } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { GrokVideoProvider, FalKlingT2VProvider, VideoProviderError } from '@/lib/video';
import { resolveTextToVideoRoute } from '@/lib/video/resolve-route';
import type { VideoQualityTier } from '@/lib/video/resolve-route';

const schema = z.object({
  prompt:      z.string().min(1).max(1000),
  duration:    z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('16:9'),
  style:       z.enum(['product', 'food', 'beauty', 'social', 'space', 'service', 'hospitality', 'fitness', 'fashion']).default('product'),
  quality:     z.enum(['quick', 'best']).default('quick'),
});

const IS_MOCK = process.env.STUDIO_MOCK === 'true';

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

  const userId = session.user.id;
  const body   = schema.parse(rawBody);

  const ip       = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(userId);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro' | 'byok';

  if (!(await checkRateLimitWithBypass(`vid:${ip}:${userId}`, RATE_LIMITS.generateVideo[planType as 'free' | 'starter' | 'pro'], userId))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  if (isAbusivePrompt(body.prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  const [userIsSuperuser, videoJobCount] = await Promise.all([
    isSuperuser(userId),
    db.studioJob.count({ where: { userId, type: 'video' } }),
  ]);

  const availableVideoCredits = credits.monthlyVideos + credits.bonusVideos;

  const route = resolveTextToVideoRoute({
    style:                body.style,
    quality:              body.quality as VideoQualityTier,
    durationSeconds:      body.duration as 5 | 10 | 15,
    planType,
    isSuperuser:          userIsSuperuser,
    byokEnabled:          credits.byokEnabled,
    isFirstVideoEver:     videoJobCount === 0,
    availableVideoCredits,
  });

  // Credit check — skip for free trial and superusers/byok
  if (route.creditCost > 0) {
    const creditCheck = await checkCredits(userId, 'video', route.creditCost);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }
  }

  if (IS_MOCK) {
    return NextResponse.json({ jobId: `mock-job-${Date.now()}` });
  }

  try {
    let predictionId: string;

    if (route.provider === 'fal-t2v') {
      // Resolve fal API key: BYOK first, then platform env
      const falKeyRecord = await db.userApiKey.findUnique({
        where: { userId_provider: { userId, provider: 'fal' } },
        select: { encryptedKey: true },
      });
      const falKey = falKeyRecord
        ? decrypt(falKeyRecord.encryptedKey)
        : (process.env.FAL_KEY ?? '');

      if (!falKey && !userIsSuperuser) {
        return NextResponse.json({ error: 'fal.ai API key not configured' }, { status: 500 });
      }

      const provider = new FalKlingT2VProvider();
      const result   = await provider.createVideo({
        prompt:      body.prompt,
        duration:    body.duration,
        aspectRatio: body.aspectRatio,
      }, falKey);

      predictionId = `fal-t2v:${result.predictionId}`;
    } else {
      const xaiKey = process.env.XAI_API_KEY ?? '';
      if (!xaiKey && !userIsSuperuser) {
        return NextResponse.json({ error: 'xAI API key not configured' }, { status: 500 });
      }

      const provider = new GrokVideoProvider();
      const result   = await provider.createVideo({
        prompt:      body.prompt,
        duration:    body.duration,
        aspectRatio: body.aspectRatio,
      }, xaiKey);

      predictionId = `grok:${result.predictionId}:${Date.now()}`;
    }

    const jobId = await createJob({
      userId,
      predictionId,
      type:         'video',
      creditType:   'video',
      creditAmount: route.creditCost,
      metadata: {
        qualityTier: route.qualityTier,
        routeReason: route.reason,
        modelUsed:   route.provider,
        style:       body.style,
      },
    });

    return NextResponse.json({ jobId, qualityTier: route.qualityTier });
  } catch (err) {
    if (err instanceof VideoProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[generate-video-t2v]', err);
    return NextResponse.json({ error: 'Video generation failed' }, { status: 500 });
  }
}
