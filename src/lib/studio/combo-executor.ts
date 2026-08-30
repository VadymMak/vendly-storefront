import { executeTool } from './tool-executor';
import { extractLastFrame } from './frame-extractor';
import type { MediaAttachment, SessionContext, ToolName } from './types';
import type { ComboStep } from './prompt-library';

const BASE_URL =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/** Poll job until terminal state, return video URL or null. Max 4 min wait. */
async function waitForJobComplete(jobId: string, cookieHeader: string): Promise<string | null> {
  const maxWait = 240_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(`${BASE_URL}/api/studio/job/${jobId}`, {
      headers: { Cookie: cookieHeader },
      next: { revalidate: 0 },
    });
    if (!res.ok) break;
    const data = await res.json() as { status: string; outputUrl?: string };
    if (data.status === 'succeeded') return data.outputUrl ?? null;
    if (data.status === 'failed' || data.status === 'canceled') return null;
    await new Promise<void>((r) => setTimeout(r, 5000));
  }
  return null;
}

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
        'slow orbit left, atmospheric depth, diffused soft light',
        'gentle tilt up, revealing scene, soft morning light',
        'slow push in, intimate framing, warm bokeh background',
        'subtle pan left, wide establishing shot, golden tones',
        'slight handheld drift, naturalistic feel, ambient light',
        'slow dolly back, expanding scene, cinematic depth of field',
      ];

      const sceneDuration = (step.params?.duration as number) || (currentContext.sceneDuration as number) || 3;

      // Sequential generation with frame continuity:
      // last frame of clip N becomes image_start for clip N+1
      const jobIds: string[] = [];
      let lastFrameUrl: string | null = null;

      for (let idx = 0; idx < allImages.length; idx++) {
        const imageUrl = allImages[idx];
        // Scene 0 starts from its generated image; subsequent scenes start from last frame of previous clip
        const startImageUrl = lastFrameUrl ?? imageUrl;
        const animCtx: SessionContext = { ...currentContext, lastImageUrl: startImageUrl };

        const result = await executeTool(
          'image_to_video',
          {
            prompt: motionPrompts[idx % motionPrompts.length],
            aspectRatio: '9:16',
            duration: sceneDuration,
          },
          animCtx,
          cookieHeader,
        );

        if (result.jobId) {
          jobIds.push(result.jobId);

          // Wait for this clip to complete so we can extract its last frame for the next clip
          if (idx < allImages.length - 1) {
            console.log(`[continuity] waiting for clip ${idx} (job ${result.jobId})...`);
            const videoUrl = await waitForJobComplete(result.jobId, cookieHeader);
            if (videoUrl) {
              lastFrameUrl = await extractLastFrame(videoUrl);
              console.log(`[continuity] clip ${idx} last frame → clip ${idx + 1}: ${lastFrameUrl ? 'ok' : 'skipped'}`);
            }
          }
        }
      }

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

    // LoRA image generation: delegate to generate_character which has full LoRA + Replicate support
    if (step.tool === 'generate_image' && params.use_lora && currentContext.loraModel) {
      const loraResult = await executeTool('generate_character', {
        scene_description: String(params.scene_description || ''),
      }, currentContext, cookieHeader);

      const loraStepResult: StepResult = { stepIndex: i, description: step.description };
      if (loraResult.error) {
        loraStepResult.error = loraResult.error;
        results.push(loraStepResult);
        break;
      }
      if (loraResult.media) {
        loraStepResult.media = loraResult.media;
        if (loraResult.media.type === 'image') currentContext.lastImageUrl = loraResult.media.url;
      }
      if (loraResult.message) loraStepResult.message = loraResult.message;
      results.push(loraStepResult);
      continue;
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
