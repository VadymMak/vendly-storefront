'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudioStore } from '@/lib/studio/store';
import { PLATFORM_IMAGE_PRESETS } from '@/lib/studio/constants';
import { InputStep } from './steps/InputStep';
import { GeneratingStep } from './steps/GeneratingStep';
import { MobileResultScreen } from './MobileResultScreen';
import type { GenerationMode } from '@/lib/types';

type Step = 1 | 2 | 'result';

const DEFAULT_PRESET_ID = 'ig-feed';

interface GenerateResult {
  imageUrl: string;
  jobId?: string;
  model?: string;
  prompt?: string;
  generationMode?: GenerationMode;
}

export function MobileCreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addImage = useStudioStore((s) => s.addImage);

  const [step, setStep] = useState<Step>(1);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID);
  const [description, setDescription] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [styleId, setStyleId] = useState('social');
  const [result, setResult] = useState<GenerateResult | null>(null);

  // ?remake=ig-story (from "Make Story") pre-selects the format. Tracked against the last seen value,
  // not a mount effect, because pushing /studio/m/create?remake=… from this wizard's own result
  // screen keeps it mounted.
  const remakePreset = searchParams.get('remake');
  const [seenRemake, setSeenRemake] = useState<string | null>(null);
  if (remakePreset !== seenRemake) {
    setSeenRemake(remakePreset);
    if (remakePreset && PLATFORM_IMAGE_PRESETS.some((p) => p.id === remakePreset)) {
      setPresetId(remakePreset);
      setStep(1);
      setResult(null);
    }
  }

  const handleInputContinue = useCallback(
    (data: { description: string; referenceImageUrl?: string; styleId: string }) => {
      setDescription(data.description);
      setReferenceImageUrl(data.referenceImageUrl);
      setStyleId(data.styleId);
      setStep(2);
    },
    [],
  );

  const handleComplete = useCallback(
    (res: GenerateResult) => {
      addImage({
        id: res.jobId ?? `mob-${Date.now()}`,
        type: 'image',
        url: res.imageUrl,
        prompt: res.prompt,
        model: res.model,
        preset: presetId,
        jobId: res.jobId,
        createdAt: Date.now(),
      });
      setResult(res);
      setStep('result');
    },
    [addImage, presetId],
  );

  const handleError = useCallback(() => {
    setStep(1);
  }, []);

  const resetWizard = useCallback(() => {
    setStep(1);
    setPresetId(DEFAULT_PRESET_ID);
    setDescription('');
    setReferenceImageUrl(undefined);
    setStyleId('social');
    setResult(null);
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      {step === 1 && (
        <InputStep
          onContinue={handleInputContinue}
          onBack={() => router.push('/studio/m')}
          presetId={presetId}
          onPresetChange={setPresetId}
          initialDescription={description}
          initialReferenceImageUrl={referenceImageUrl}
          initialStyleId={styleId}
        />
      )}
      {step === 2 && (
        <GeneratingStep
          generateParams={{ prompt: description, presetId, styleId, referenceImageUrl }}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
      {step === 'result' && result && (
        <MobileResultScreen
          inlineResult={{
            imageUrl: result.imageUrl,
            prompt: result.prompt,
            description,
            model: result.model,
            presetId,
            styleId,
            referenceImageUrl,
            generationMode: result.generationMode,
          }}
          onBack={resetWizard}
          onRegenerate={() => setStep(2)}
          onTryStyle={() => setStep(1)}
        />
      )}
    </div>
  );
}
