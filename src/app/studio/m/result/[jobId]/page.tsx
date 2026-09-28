import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getJob } from '@/lib/studio-jobs';
import { MobileResultScreen } from '@/components/studio/mobile/MobileResultScreen';

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function MobileResultPage({ params }: Props) {
  const { jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m');

  const job = await getJob(jobId, session.user.id);
  if (!job) redirect('/studio/m');

  const meta = (job.metadata as Record<string, unknown> | null) ?? {};

  return (
    <MobileResultScreen
      job={{
        id: job.id,
        outputUrl: job.outputUrl ?? null,
        status: job.status,
        prompt: typeof meta.prompt === 'string' ? meta.prompt : null,
        modelUsed: typeof meta.model === 'string' ? meta.model : null,
        createdAt: job.createdAt,
      }}
    />
  );
}
