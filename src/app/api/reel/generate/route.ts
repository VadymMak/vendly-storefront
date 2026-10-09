import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeCredits, refundCredits, REEL_CREDIT_COST, type ReelMode } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';

const REEL_SERVICE_URL = 'http://127.0.0.1:3010';

// StudioJob row that records what a reel was charged — no outputUrl, so the Gallery never lists it
const reelPredictionId = (jobId: string) => `reel:${jobId}`;

interface ReelCharge {
  mode:        ReelMode;
  fromBonus:   number;
  fromMonthly: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { photos?: unknown; mode?: unknown; cta1?: unknown; cta2?: unknown; musicTrackId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { photos, cta1, cta2, musicTrackId } = body;

  const mode = body.mode ?? 'images';
  if (mode !== 'images' && mode !== 'video') {
    return NextResponse.json({ error: 'mode must be "images" or "video"' }, { status: 400 });
  }
  const cost = REEL_CREDIT_COST[mode];

  if (
    !(await checkRateLimitWithBypass(`reel:hour:${userId}`, RATE_LIMITS.reel.hourly, userId)) ||
    !(await checkRateLimitWithBypass(`reel:day:${userId}`, RATE_LIMITS.reel.daily, userId))
  ) {
    return NextResponse.json({ error: 'Too many reels. Please try again later.' }, { status: 429 });
  }

  // Charge up front: a reel takes minutes and pays FAL before it finishes, so a
  // charge-on-success check would let parallel requests start reels the balance can't cover.
  // allowByok: false — reels run on the platform FAL_KEY, BYOK keys are never used.
  const charge = await consumeCredits(userId, cost.type, cost.amount, undefined, { allowByok: false });
  if (!charge.success) {
    return NextResponse.json({
      error:        cost.type === 'video'
        ? `Not enough video credits for a video reel (${cost.amount} needed)`
        : `Not enough image credits for a reel (${cost.amount} needed)`,
      needsUpgrade: true,
      creditType:   cost.type,
      required:     cost.amount,
    }, { status: 402 });
  }
  const fromBonus   = charge.fromBonus ?? 0;
  const fromMonthly = charge.fromMonthly ?? 0;

  let jobId: string | undefined;
  try {
    const response = await fetch(`${REEL_SERVICE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, mode, cta1, cta2, userId, musicTrackId: musicTrackId || 'warm-cafe' }),
    });

    const data = await response.json();
    jobId = typeof data.jobId === 'string' ? data.jobId : undefined;
    if (!response.ok || !jobId) {
      await refundCredits(userId, cost.type, fromBonus, fromMonthly);
      return NextResponse.json(data, { status: response.ok ? 500 : response.status });
    }
  } catch (error: unknown) {
    await refundCredits(userId, cost.type, fromBonus, fromMonthly);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reel/generate] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const metadata: ReelCharge = { mode, fromBonus, fromMonthly };
    await db.studioJob.create({
      data: {
        userId,
        predictionId:   reelPredictionId(jobId),
        type:           'reel',
        status:         'processing',
        creditType:     cost.type,
        creditAmount:   cost.amount,
        creditDeducted: true,
        metadata:       { ...metadata },
      },
    });
  } catch (err) {
    // The reel is already running and paid for — only a refund on failure is lost
    console.error(`[reel/generate] StudioJob record failed for ${jobId}:`, err);
  }

  return NextResponse.json({ jobId, status: 'queued' });
}

/**
 * Refunds a failed reel exactly once — the status claim makes repeated polls a no-op.
 * A job reel-service no longer knows (404 after restart/cleanup) is NOT refunded:
 * the finished video can be fetched without polling, so 404 doesn't prove failure.
 */
async function settleReel(userId: string, jobId: string, reelStatus: string) {
  const predictionId = reelPredictionId(jobId);

  if (reelStatus === 'done') {
    await db.studioJob.updateMany({
      where: { predictionId, userId, status: 'processing' },
      data:  { status: 'succeeded' },
    });
    return;
  }
  if (reelStatus !== 'error') return;

  const job = await db.studioJob.findUnique({ where: { predictionId } });
  if (!job || job.userId !== userId || !job.creditDeducted) return;

  const claimed = await db.studioJob.updateMany({
    where: { id: job.id, status: 'processing', creditDeducted: true },
    data:  { status: 'failed', creditDeducted: false },
  });
  if (claimed.count !== 1) return;

  const meta = (job.metadata ?? {}) as Partial<ReelCharge>;
  await refundCredits(userId, job.creditType as 'image' | 'video', meta.fromBonus ?? 0, meta.fromMonthly ?? 0);
  console.log(`[reel/generate] Refunded failed reel ${jobId}: userId=${userId} ${job.creditType}=${job.creditAmount}`);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    // reel-service only returns jobs owned by this user
    const response = await fetch(
      `${REEL_SERVICE_URL}/generate/status/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(session.user.id)}`,
    );
    const data = await response.json();

    if (response.ok && typeof data.status === 'string') {
      try {
        await settleReel(session.user.id, jobId, data.status);
      } catch (err) {
        console.error(`[reel/generate] settle failed for ${jobId}:`, err);
      }
    }

    // reel-service listens on 127.0.0.1 only — the browser gets the reel through /api/reel/video
    if (data.result?.videoUrl) {
      data.result.videoUrl = `/api/reel/video/${encodeURIComponent(jobId)}`;
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
