'use client';

import { useState, useCallback } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import { FormatStep } from './steps/FormatStep';
import { InputStep } from './steps/InputStep';
import { StyleStep } from './steps/StyleStep';
import { GeneratingStep } from './steps/GeneratingStep';
import { MobileResultScreen } from './MobileResultScreen';

type Step = 1 | 2 | 3 | 4 | 'result';

interface GenerateResult {
  imageUrl: string;
  jobId?: string;
  model?: string;
  prompt?: string;
}

export function MobileCreateWizard() {
  const addImage = useStudioStore((s) => s.addImage);

  const [step, setStep] = useState<Step>(1);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [styleId, setStyleId] = useState('social');
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleFormatSelect = useCallback((id: string) => {
    setPresetId(id);
    setStep(2);
  }, []);

  const handleInputContinue = useCallback(
    (data: { description: string; referenceImageUrl?: string }) => {
      setDescription(data.description);
      setReferenceImageUrl(data.referenceImageUrl);
      setStep(3);
    },
    [],
  );

  const handleStyleGenerate = useCallback((style: string) => {
    setStyleId(style);
    setStep(4);
  }, []);

  const handleComplete = useCallback(
    (res: GenerateResult) => {
      addImage({
        id: res.jobId ?? `mob-${Date.now()}`,
        type: 'image',
        url: res.imageUrl,
        prompt: res.prompt,
        model: res.model,
        preset: presetId ?? undefined,
        jobId: res.jobId,
        createdAt: Date.now(),
      });
      setResult(res);
      setStep('result');
    },
    [addImage, presetId],
  );

  const handleError = useCallback(() => {
    setStep(3);
  }, []);

  const resetWizard = useCallback(() => {
    setStep(1);
    setPresetId(null);
    setDescription('');
    setReferenceImageUrl(undefined);
    setStyleId('social');
    setResult(null);
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      {step === 1 && <FormatStep onSelect={handleFormatSelect} />}
      {step === 2 && (
        <InputStep
          onContinue={handleInputContinue}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StyleStep
          onGenerate={handleStyleGenerate}
          onBack={() => setStep(2)}
          hasReferenceImage={!!referenceImageUrl}
        />
      )}
      {step === 4 && presetId && (
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
            model: result.model,
            presetId: presetId ?? undefined,
            styleId,
            referenceImageUrl,
          }}
          onBack={resetWizard}
          onRegenerate={() => setStep(4)}
          onTryStyle={() => setStep(3)}
        />
      )}
    </div>
  );
}
