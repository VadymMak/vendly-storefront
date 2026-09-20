import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { FalKlingProvider, KlingDirectProvider } from '@/lib/video';

export type JobType = 'image' | 'video' | 'upscale' | 'remove-bg' | 'ai-edit';
export type JobStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export async function createJob(params: {
  userId: string;
  predictionId: string;
  type: JobType;
  creditType?: 'image' | 'video';
  creditAmount?: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const job = await db.studioJob.create({
    data: {
      userId:       params.userId,
      predictionId: params.predictionId,
      type:         params.type,
      creditType:   params.creditType,
      creditAmount: params.creditAmount ?? 1,
      metadata:     params.metadata as Prisma.InputJsonObject | undefined,
    },
  });
  return job.id;
}

/**
 * Poll Replicate for prediction status and sync to DB.
 * Returns cached result immediately for terminal states.
 */
export async function refreshJobStatus(
  jobId: string,
  replicateKey: string,
  klingCompositeKey?: string,
  falKey?: string,
): Promise<{ status: JobStatus; outputUrl?: string; error?: string }> {
  const job = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');

  if (
    job.status === 'succeeded' ||
    job.status === 'failed' ||
    job.status === 'canceled'
  ) {
    return {
      status:    job.status as JobStatus,
      outputUrl: job.outputUrl ?? undefined,
      error:     job.error ?? undefined,
    };
  }

  // Video runs on whichever backend VIDEO_PROVIDER selects; every other job
  // type is always a Replicate prediction, so it must not go through the
  // video provider (a non-Replicate one would not recognise the id).
  const polled = job.type === 'video'
    ? await pollVideoPrediction(job.predictionId, replicateKey, klingCompositeKey, falKey)
    : await pollReplicatePrediction(job.predictionId, replicateKey);

  // Backend unreachable — keep the current status and retry on the next poll.
  if (!polled) {
    return { status: job.status as JobStatus };
  }

  const { status: newStatus, outputUrl } = polled;

  await db.studioJob.update({
    where: { id: jobId },
    data: {
      status:    newStatus,
      outputUrl: outputUrl ?? undefined,
      error:     polled.error ?? undefined,
    },
  });

  // Deduct credit exactly once on success
  if (newStatus === 'succeeded' && !job.creditDeducted && job.creditType) {
    const { deductCredit } = await import('@/lib/credits');
    await deductCredit(
      job.userId,
      job.creditType as 'image' | 'video',
      job.creditAmount,
    );
    await db.studioJob.update({
      where: { id: jobId },
      data: { creditDeducted: true },
    });
  }

  return {
    status:    newStatus,
    outputUrl: outputUrl ?? undefined,
    error:     polled.error ?? undefined,
  };
}

interface PolledPrediction {
  status:     JobStatus;
  outputUrl?: string;
  error?:     string;
}

/** Collapses provider statuses to the set persisted on StudioJob. */
function toJobStatus(status: string): JobStatus {
  return status === 'succeeded' ? 'succeeded'
    : status === 'failed'   ? 'failed'
    : status === 'canceled' ? 'canceled'
    : 'processing';
}

async function pollVideoPrediction(
  predictionId: string,
  replicateKey: string,
  klingKey?:    string,
  falKey?:      string,
): Promise<PolledPrediction | null> {
  try {
    // fal.ai predictions — prefixed with "fal:"
    if (predictionId.startsWith('fal:')) {
      const requestId = predictionId.replace('fal:', '');
      const key = falKey || process.env.FAL_KEY || '';
      const result = await new FalKlingProvider().pollVideo(requestId, key);
      return {
        status:    toJobStatus(result.status),
        outputUrl: result.videoUrl,
        error:     result.error,
      };
    }

    // Kling Direct predictions — prefixed with "kling-direct:"
    if (predictionId.startsWith('kling-direct:')) {
      const taskId = predictionId.replace('kling-direct:', '');
      const result = await new KlingDirectProvider().pollVideo(taskId, klingKey ?? '');
      return {
        status:    toJobStatus(result.status),
        outputUrl: result.videoUrl,
        error:     result.error,
      };
    }

    // Replicate predictions — no prefix (legacy + fallback)
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${replicateKey}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const prediction = await res.json() as {
      status: string;
      output?: string | string[];
      error?: string;
    };
    return {
      status:    toJobStatus(prediction.status),
      outputUrl: prediction.status === 'succeeded'
        ? (Array.isArray(prediction.output) ? prediction.output[0] : prediction.output)
        : undefined,
      error: prediction.error,
    };
  } catch {
    return null;
  }
}

/** Image, upscale, remove-bg and ai-edit jobs are always Replicate predictions. */
async function pollReplicatePrediction(
  predictionId: string,
  apiKey:       string,
): Promise<PolledPrediction | null> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;

  const prediction = await res.json() as {
    status: string;
    output?: string | string[];
    error?: string;
  };

  const status = toJobStatus(prediction.status);

  return {
    status,
    outputUrl: status === 'succeeded'
      ? (Array.isArray(prediction.output) ? prediction.output[0] : prediction.output)
      : undefined,
    error: prediction.error,
  };
}

/** Get a job by ID with ownership check. Returns null if not found or not owned. */
export async function getJob(jobId: string, userId: string) {
  const job = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) return null;
  return job;
}
