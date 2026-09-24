import { fal } from '@fal-ai/client';
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoProvider,
} from './provider';
import { VideoProviderError } from './provider';

const MODEL_ID = 'fal-ai/kling-video/v3/standard/text-to-video';

function toStatus(falStatus: string): VideoGenerationStatus {
  switch (falStatus) {
    case 'COMPLETED':   return 'succeeded';
    case 'FAILED':      return 'failed';
    case 'IN_PROGRESS': return 'processing';
    case 'IN_QUEUE':    return 'starting';
    default:            return 'processing';
  }
}

interface FalVideoOutput {
  video?: { url: string };
}

export class FalKlingT2VProvider implements VideoProvider {
  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    fal.config({ credentials: apiKey });

    // Kling T2V supports 5s and 10s only — clamp 15s to 10s
    const duration = String(req.duration === 15 ? 10 : (req.duration ?? 5));

    const input = {
      prompt:   req.prompt,
      duration,
      ...(req.aspectRatio    && { aspect_ratio:    req.aspectRatio }),
      ...(req.negativePrompt && { negative_prompt: req.negativePrompt }),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fal.queue.submit(MODEL_ID, { input: input as any });
      const requestId = result.request_id;

      if (!requestId) {
        throw new VideoProviderError('fal.ai returned no request_id', 502);
      }

      return { predictionId: requestId, status: 'starting' };
    } catch (error) {
      if (error instanceof VideoProviderError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new VideoProviderError(`fal.ai kling-t2v error: ${msg}`, 502);
    }
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    fal.config({ credentials: apiKey });

    try {
      const statusResult = await fal.queue.status(MODEL_ID, {
        requestId: predictionId,
        logs: false,
      });

      const status = toStatus(statusResult.status);

      if (status === 'succeeded') {
        const fullResult = await fal.queue.result(MODEL_ID, { requestId: predictionId });
        const data = fullResult.data as FalVideoOutput;
        const videoUrl = data?.video?.url;
        return {
          predictionId,
          status: 'succeeded',
          videoUrl,
          error: videoUrl ? undefined : 'No video URL in response',
        };
      }

      if (status === 'failed') {
        return { predictionId, status: 'failed', error: 'fal.ai kling-t2v generation failed' };
      }

      return { predictionId, status };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new VideoProviderError(`fal.ai kling-t2v poll error: ${msg}`, 502);
    }
  }

  getModelName():    string { return 'kling-v3-t2v'; }
  getDisplayName():  string { return 'Kling v3.0 T2V'; }
  getCostEstimate(): string { return '$0.40-0.85 per video'; }
}
