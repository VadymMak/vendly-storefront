import type { VideoProvider, VideoGenerationRequest, VideoGenerationResult } from './provider';
import { VideoProviderError } from './provider';

const XAI_BASE_URL = 'https://api.x.ai/v1';
const MODEL = 'grok-imagine-video-1.5';

interface XAIJobResponse {
  id: string;
  status: string;
  video?: { url: string };
  error?: string;
}

export class GrokVideoProvider implements VideoProvider {
  getModelName()    { return MODEL; }
  getDisplayName()  { return 'Grok Video 1.5'; }
  getCostEstimate() { return '$0.15–0.30'; }

  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    const res = await fetch(`${XAI_BASE_URL}/video/generations`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:        MODEL,
        prompt:       req.prompt,
        aspect_ratio: req.aspectRatio ?? '16:9',
        duration:     req.duration,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new VideoProviderError(err?.error?.message ?? `xAI error ${res.status}`, res.status);
    }

    const data = await res.json() as XAIJobResponse;
    return { predictionId: data.id, status: 'starting' };
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    const res = await fetch(`${XAI_BASE_URL}/video/generations/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new VideoProviderError(err?.error?.message ?? `xAI error ${res.status}`, res.status);
    }

    const data = await res.json() as XAIJobResponse;
    return {
      predictionId: data.id,
      status: data.status as VideoGenerationResult['status'],
      videoUrl: data.status === 'succeeded' ? data.video?.url : undefined,
      error:    data.error,
    };
  }
}
