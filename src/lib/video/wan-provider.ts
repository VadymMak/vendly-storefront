/* eslint-disable @typescript-eslint/no-unused-vars -- stub signatures document the contract */
import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProvider,
} from './provider';
import { VideoProviderError } from './provider';

/**
 * Self-hosted Wan 2.2 backend — stub.
 *
 * Will call WAN_API_URL (ComfyUI or a custom FastAPI wrapper) once the box is
 * provisioned. Until then every call fails loudly so a misconfigured
 * VIDEO_PROVIDER=wan can never silently degrade to nothing.
 */
export class WanProvider implements VideoProvider {
  async createVideo(_req: VideoGenerationRequest, _apiKey: string): Promise<VideoGenerationResult> {
    throw new VideoProviderError('Wan provider not configured', 501);
  }

  async pollVideo(_predictionId: string, _apiKey: string): Promise<VideoGenerationResult> {
    throw new VideoProviderError('Wan provider not configured', 501);
  }

  getModelName():    string { return 'wan-2.2'; }
  getDisplayName():  string { return 'Wan 2.2'; }
  getCostEstimate(): string { return 'self-hosted'; }
}
