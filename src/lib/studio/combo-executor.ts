import { executeTool } from './tool-executor';
import type { MediaAttachment, SessionContext, ToolName } from './types';
import type { ComboStep } from './prompt-library';

export interface StepResult {
  stepIndex: number;
  description: string;
  media?: MediaAttachment;
  message?: string;
  jobId?: string;
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
      steps[startIndex].tool === 'generate_image'
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

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    // create_clip is client-side only — signal frontend to render from collected images
    if (step.tool === 'create_clip') {
      results.push({
        stepIndex: i,
        description: step.description,
        message: '__CREATE_CLIP__',
      });
      break;
    }

    const params: Record<string, string | number | boolean> = {
      ...(step.params as Record<string, string | number | boolean>),
    };

    if (step.tool === 'write_caption') {
      params.topic = userInput || 'this product';
    } else if (step.promptTemplate) {
      params.prompt = step.promptTemplate.replace('{subject}', userInput || 'the product');
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
