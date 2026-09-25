import { createFalClient } from '@fal-ai/client';
import type {
  CameraMotion,
  CameraType,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoProvider,
} from './provider';
import { VideoProviderError } from './provider';

const MODEL_ID = 'fal-ai/kling-video/v3/standard/image-to-video';

const CAMERA_PROMPTS: Record<CameraType, string> = {
  zoom_in:     'slow dolly push in, camera moves forward toward subject',
  zoom_out:    'slow dolly pull out, camera moves backward revealing space',
  pan_left:    'smooth camera pan left, horizontal slide',
  pan_right:   'smooth camera pan right, horizontal slide',
  tilt_up:     'crane up shot, camera slowly rises from low to high angle',
  tilt_down:   'crane down shot, camera slowly descends from high to low',
  orbit_left:  'slow orbit shot, camera circles subject from right to left',
  orbit_right: 'slow orbit shot, camera circles subject from left to right',
  none:        '',
};

function buildCameraFragment(camera: CameraMotion): string {
  if (camera.type === 'none') return '';
  const intensity = camera.value <= 3 ? 'subtle' : camera.value <= 6 ? 'smooth' : 'dramatic';
  return `, ${CAMERA_PROMPTS[camera.type]}, ${intensity} motion, continuous fluid movement`;
}

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

/**
 * fal.ai Kling 3.0 Standard provider.
 * Uses fal queue API for async create + poll pattern.
 * predictionId format: "fal:{request_id}" — the prefix tells the polling
 * layer which provider to use.
 */
export class FalKlingProvider implements VideoProvider {
  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    const fal = createFalClient({ credentials: apiKey });

    const prompt = req.camera
      ? `${req.prompt}${buildCameraFragment(req.camera)}`
      : req.prompt;

    const input = {
      prompt,
      duration:      String(req.duration ?? 5),
      start_image_url: req.startImage ?? '',
      ...(req.aspectRatio    && { aspect_ratio:     req.aspectRatio }),
      ...(req.negativePrompt && { negative_prompt:  req.negativePrompt }),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fal.queue.submit(MODEL_ID, { input: input as any });
      const requestId = result.request_id;

      if (!requestId) {
        throw new VideoProviderError('fal.ai returned no request_id', 502);
      }

      return {
        predictionId: requestId,
        status:       'starting',
      };
    } catch (error) {
      if (error instanceof VideoProviderError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new VideoProviderError(`fal.ai video error: ${msg}`, 502);
    }
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    const fal = createFalClient({ credentials: apiKey });

    try {
      const statusResult = await fal.queue.status(MODEL_ID, {
        requestId: predictionId,
        logs: false,
      });

      const status = toStatus(statusResult.status);

      if (status === 'succeeded') {
        const fullResult = await fal.queue.result(MODEL_ID, {
          requestId: predictionId,
        });
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
        return {
          predictionId,
          status: 'failed',
          error: 'fal.ai video generation failed',
        };
      }

      return { predictionId, status };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new VideoProviderError(`fal.ai poll error: ${msg}`, 502);
    }
  }

  getModelName():    string { return 'fal-ai/kling-video/v3/standard'; }
  getDisplayName():  string { return 'Kling v3.0 (fal.ai)'; }
  getCostEstimate(): string { return '$0.40-0.85'; }
}
