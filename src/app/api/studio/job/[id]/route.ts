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

  const job = await getJob(id, session.user.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Video predictions are created under the user's own Replicate account.
  // Use their key for status polling; fall back to platform key for platform-created jobs.
  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');

  if (!replicateKey) {
    return NextResponse.json({ error: 'No Replicate API key available' }, { status: 500 });
  }

  try {
    const result = await refreshJobStatus(job.id, replicateKey);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[studio/job]', err);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
