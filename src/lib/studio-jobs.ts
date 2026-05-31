import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

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

  const res = await fetch(`https://api.replicate.com/v1/predictions/${job.predictionId}`, {
    headers: { Authorization: `Bearer ${replicateKey}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return { status: job.status as JobStatus };
  }

  const prediction = await res.json() as {
    status: string;
    output?: string | string[];
    error?: string;
  };

  const newStatus: JobStatus =
    prediction.status === 'succeeded' ? 'succeeded'
    : prediction.status === 'failed'   ? 'failed'
    : prediction.status === 'canceled' ? 'canceled'
    : 'processing';

  const outputUrl =
    prediction.status === 'succeeded'
      ? (Array.isArray(prediction.output) ? prediction.output[0] : prediction.output) ?? null
      : null;

  await db.studioJob.update({
    where: { id: jobId },
    data: {
      status:    newStatus,
      outputUrl: outputUrl ?? undefined,
      error:     prediction.error ?? undefined,
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
    error:     prediction.error ?? undefined,
  };
}

/** Get a job by ID with ownership check. Returns null if not found or not owned. */
export async function getJob(jobId: string, userId: string) {
  const job = await db.studioJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) return null;
  return job;
}
