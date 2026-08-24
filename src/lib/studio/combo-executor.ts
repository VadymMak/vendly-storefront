import { executeTool } from './tool-executor';
import type { MediaAttachment, SessionContext, ToolName } from './types';
import type { ComboStep } from './prompt-library';

export interface StepResult {
  stepIndex: number;
  description: string;
  media?: MediaAttachment;
  message?: string;
  jobId?: string;
  jobIds?: string[];
  error?: string;
}

export interface ComboResult {
  steps: StepResult[];
  finalContext: SessionContext;
  finalMessage: string;
}

export async function executeCombo(
  steps: ComboStep[],
  userInput: string,
  context: SessionContext,
  cookieHeader: string,
): Promise<ComboResult> {
  const results: StepResult[] = [];
  let currentContext = { ...context };

  // If user already has an image, skip generate_image steps at the beginning
  // This allows combos to work with uploaded images instead of always generating new ones
  let startIndex = 0;
  if (currentContext.lastImageUrl) {
    while (
      startIndex < steps.length &&
      steps[startIndex].tool === 'generate_image' &&
      !steps[startIndex].alwaysGenerate
    ) {
      results.push({
        stepIndex: startIndex,
        description: steps[startIndex].description,
        message: 'Skipped — using your uploaded image',
      });
      startIndex++;
    }
    if (startIndex > 0) {
      console.log(`[combo-executor] Skipped ${startIndex} generate_image step(s) — user has image in context`);
    }
  }

  // For enhance_for_platform: override transform_image preset based on user's subject (platform)
  const platformPresetMap: Record<string, string> = {
    instagram_reel: 'instagram_story',
    instagram_post: 'instagram_square',
    instagram_story: 'instagram_story',
    tiktok: 'tiktok',
    youtube_shorts: 'tiktok',
    facebook_post: 'facebook_post',
  };
  const targetPreset = platformPresetMap[userInput] ?? null;
  if (targetPreset) {
    for (const step of steps) {
      if (step.tool === 'transform_image' && step.params) {
        step.params.preset = targetPreset;
      }
    }
  }

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    // create_clip with animate_all: launch Kling for every generated image in parallel
    if (step.tool === 'create_clip' && step.params?.animate_all) {
      const allImages = results
        .filter((r) => r.media?.type === 'image')
        .map((r) => r.media!.url);

      const motionPrompts = [
        'slow dolly forward, cinematic movement, warm atmospheric lighting',
        'gentle camera pull-back, subject in focus, golden hour light',
        'subtle pan right, intimate close detail, warm cinematic',
        'slow zoom in, cinematic depth, natural light shift',
      ];

      const animResults = await Promise.all(
        allImages.map((imageUrl, idx) => {
          const animCtx: SessionContext = { ...currentContext, lastImageUrl: imageUrl };
          return executeTool(
            'image_to_video',
            {
              prompt: motionPrompts[idx] ?? motionPrompts[0],
              aspectRatio: '9:16',
              duration: 5,
            },
            animCtx,
            cookieHeader,
          );
        }),
      );

      const jobIds = animResults
        .map((r) => r.jobId ?? null)
        .filter((id): id is string => id !== null);

      results.push({
        stepIndex: i,
        description: step.description,
        jobIds,
        message: `Animating ${allImages.length} scenes in parallel (~2-3 min)`,
      });
      // No break — animate_all is the final meaningful step
      continue;
    }

    // create_clip without animate_all — client-side render signal
    if (step.tool === 'create_clip') {
      results.push({
        stepIndex: i,
        description: step.description,
        message: '__CREATE_CLIP__',
      });
      break;
    }

    // useUploadedAsInput: skip generation and use uploaded photo directly as scene output
    if (step.useUploadedAsInput && currentContext.uploadedReferenceUrl) {
      const uploadedUrl = currentContext.uploadedReferenceUrl;
      results.push({
        stepIndex: i,
        description: 'Using your uploaded photo as scene 1',
        media: { type: 'image', url: uploadedUrl },
      });
      currentContext.lastImageUrl = uploadedUrl;
      continue;
    }

    const params: Record<string, string | number | boolean> = {
      ...(step.params as Record<string, string | number | boolean>),
    };

    if (step.tool === 'write_caption') {
      params.topic = userInput || 'this product';
    } else if (step.promptTemplate) {
      params.prompt = step.promptTemplate.replace('{subject}', userInput || 'the product');
    }

    // Scenes 2-3: use Flux Redux for style consistency when uploaded reference exists
    if (step.tool === 'generate_image' && currentContext.uploadedReferenceUrl && !step.useUploadedAsInput) {
      params.provider = 'flux-redux';
      params.reference_image = currentContext.uploadedReferenceUrl;
    }

    const result = await executeTool(
      step.tool as ToolName,
      params,
      currentContext,
      cookieHeader,
    );

    const stepResult: StepResult = {
      stepIndex: i,
      description: step.description,
    };

    if (result.error) {
      stepResult.error = result.error;
      results.push(stepResult);
      break;
    }

    if (result.media) {
      stepResult.media = result.media;
      if (result.media.type === 'image') {
        currentContext.lastImageUrl = result.media.url;
      } else if (result.media.type === 'video') {
        currentContext.lastVideoUrl = result.media.url;
      }
    }

    if (result.message) {
      stepResult.message = result.message;
    }

    if (result.jobId) {
      stepResult.jobId = result.jobId;
      results.push(stepResult);
      break;
    }

    results.push(stepResult);
  }

  const completedSteps = results.filter((r) => !r.error);
  const failedStep = results.find((r) => r.error);
  const hasVideo = results.some((r) => r.jobId);

  let finalMessage = `Completed ${completedSteps.length}/${steps.length} steps.`;
  if (failedStep) {
    finalMessage += ` Step "${failedStep.description}" failed: ${failedStep.error}`;
  }
  if (hasVideo) {
    finalMessage += ' Video is generating (2-3 minutes)...';
  }

  return {
    steps: results,
    finalContext: currentContext,
    finalMessage,
  };
}
