import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getJob } from '@/lib/studio-jobs';
import { PLATFORM_IMAGE_PRESETS, STYLE_CHIPS } from '@/lib/studio/constants';
import type { GenerationMode } from '@/lib/types';
import { ResultPageClient } from './ResultPageClient';

interface Props {
  params: Promise<{ jobId: string }>;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

export default async function MobileResultPage({ params }: Props) {
  const { jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/studio/m');

  // getJob only returns the job when it belongs to this user
  const job = await getJob(jobId, session.user.id);
  if (!job || job.status !== 'succeeded' || !job.outputUrl) redirect('/studio/m');
  // The Editor Hub edits images — videos stay in the library
  if (job.type === 'video') redirect('/studio/m/library');

  const meta = (job.metadata as Record<string, unknown> | null) ?? {};
  const prompt = str(meta.prompt) ?? '';
  // Older jobs don't store style / preset / user text — derive what we can from the stored prompt
  const styleId = str(meta.style) ?? STYLE_CHIPS.find((s) => s.promptPrefix && prompt.startsWith(s.promptPrefix))?.id;
  const prefix = STYLE_CHIPS.find((s) => s.id === styleId)?.promptPrefix ?? '';
  const description = str(meta.userDescription) ?? (prefix ? prompt.slice(prefix.length).trim() : prompt);
  const aspect = str(meta.aspect_ratio);
  const presetId = str(meta.presetId) ?? PLATFORM_IMAGE_PRESETS.find((p) => p.aspect_ratio === aspect)?.id ?? 'ig-feed';
  const generationMode: GenerationMode = meta.generationMode === 'photo_transform' ? 'photo_transform' : 'text_create';
  const referenceImage = str(meta.referenceImage);

  return (
    <ResultPageClient
      job={{
        id: job.id,
        outputUrl: job.outputUrl,
        status: job.status,
        type: job.type,
        prompt,
        modelUsed: str(meta.modelUsed) ?? null,
        createdAt: job.createdAt.toISOString(),
      }}
      inlineResult={{
        imageUrl: job.outputUrl,
        prompt,
        description,
        model: str(meta.modelUsed),
        presetId,
        styleId,
        referenceImageUrl: referenceImage?.startsWith('https://') ? referenceImage : undefined,
        generationMode,
      }}
    />
  );
}
