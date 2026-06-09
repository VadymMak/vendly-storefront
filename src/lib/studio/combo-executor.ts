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

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

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
