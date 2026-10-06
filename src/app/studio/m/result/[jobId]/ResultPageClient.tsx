'use client';

import { useRouter } from 'next/navigation';
import { MobileResultScreen } from '@/components/studio/mobile/MobileResultScreen';
import type { GenerationMode } from '@/lib/types';

interface Props {
  canExportReel: boolean;
  job: {
    id: string;
    outputUrl: string;
    status: string;
    type: string;
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

export function ResultPageClient({ canExportReel, job, inlineResult }: Props) {
  const router = useRouter();

  return (
    <MobileResultScreen
      canExportReel={canExportReel}
      job={{ ...job, createdAt: new Date(job.createdAt) }}
      // Saved results are finished images — the before/after slider belongs to the live creation flow
      inlineResult={{ ...inlineResult, referenceImageUrl: undefined }}
      onBack={() => router.push('/studio/m')}
      onTryStyle={() => router.push('/studio/m/create')}
      onRegenerate={() => router.push('/studio/m/create')}
    />
  );
}
