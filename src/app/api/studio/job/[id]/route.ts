import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

  const replicateKey = process.env.REPLICATE_API_TOKEN;
  if (!replicateKey) {
    return NextResponse.json({ error: 'Missing API token' }, { status: 500 });
  }

  try {
    const result = await refreshJobStatus(job.id, replicateKey);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[studio/job]', err);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
