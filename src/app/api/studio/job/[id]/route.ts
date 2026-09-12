import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getJob, refreshJobStatus } from '@/lib/studio-jobs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // STUDIO_MOCK: return succeeded immediately for mock job IDs
  if (id.startsWith('mock-job-')) {
    const mockVideoUrl = '/mock-clip.mp4';
    return NextResponse.json({
      status: 'succeeded',
      outputUrl: mockVideoUrl,
    });
  }

  const job = await getJob(id, session.user.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Load all keys needed for polling — Replicate for standard jobs,
  // Kling key+secret for kling-direct: prefixed predictions.
  const [keyRecord, klingKeyRec, klingSecretRec] = await Promise.all([
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
      select: { encryptedKey: true },
    }),
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'kling_key' } },
      select: { encryptedKey: true },
    }),
    db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'kling_secret' } },
      select: { encryptedKey: true },
    }),
  ]);

  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');

  const klingCompositeKey = (klingKeyRec && klingSecretRec)
    ? `${decrypt(klingKeyRec.encryptedKey)}:${decrypt(klingSecretRec.encryptedKey)}`
    : undefined;

  if (!replicateKey && !job.predictionId.startsWith('kling-direct:')) {
    return NextResponse.json({ error: 'No Replicate API key available' }, { status: 500 });
  }

  try {
    const result = await refreshJobStatus(job.id, replicateKey, klingCompositeKey);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[studio/job]', err);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
