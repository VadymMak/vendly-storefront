'use client';

import { useRouter } from 'next/navigation';
import { MobileResultScreen } from '@/components/studio/mobile/MobileResultScreen';
import type { GenerationMode } from '@/lib/types';

interface Props {
  job: {
    id: string;
    outputUrl: string;
    status: string;
    prompt: string;
    modelUsed: string | null;
    createdAt: string;
  };
  inlineResult: {
    imageUrl: string;
    prompt?: string;
    description?: string;
    model?: string;
    presetId?: string;
    styleId?: string;
    referenceImageUrl?: string;
    generationMode?: GenerationMode;
  };
}

export function ResultPageClient({ job, inlineResult }: Props) {
  const router = useRouter();

  return (
    <MobileResultScreen
      job={{ ...job, createdAt: new Date(job.createdAt) }}
      inlineResult={inlineResult}
      onBack={() => router.push('/studio/m')}
      onTryStyle={() => router.push('/studio/m/create')}
      onRegenerate={() => router.push('/studio/m/create')}
    />
  );
}
