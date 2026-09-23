import type { VideoProvider, VideoGenerationRequest, VideoGenerationResult } from './provider';
import { VideoProviderError } from './provider';

const XAI_BASE_URL = 'https://api.x.ai/v1/videos';
const MODEL = 'grok-imagine-video-1.5';

interface XAIJobResponse {
  id?:         string;
  request_id?: string;
  status:      string;
  video?:      { url: string };
  result_url?: string;
  error?:      string;
}

export class GrokVideoProvider implements VideoProvider {
  getModelName()    { return MODEL; }
  getDisplayName()  { return 'Grok Video 1.5'; }
  getCostEstimate() { return '$0.15–0.30'; }

  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    const res = await fetch(`${XAI_BASE_URL}/generations`, {
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
    console.log('[GrokVideoProvider] createVideo response:', JSON.stringify(data));
    const jobId = data.request_id ?? data.id ?? '';
    if (!jobId) throw new VideoProviderError('xAI returned no job ID', 502);
    return { predictionId: jobId, status: 'starting' };
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    console.log('[GrokVideoProvider] polling:', predictionId);

    const res = await fetch(`${XAI_BASE_URL}/generations/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    });

    console.log('[GrokVideoProvider] response status:', res.status);

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new VideoProviderError(err?.error?.message ?? `xAI error ${res.status}`, res.status);
    }

    const data = await res.json() as XAIJobResponse;
    console.log('[GrokVideoProvider] poll data:', JSON.stringify(data));

    // xAI may return 'completed' — normalise to our canonical 'succeeded'
    const rawStatus = data.status;
    const status: VideoGenerationResult['status'] =
      rawStatus === 'completed' ? 'succeeded' :
      rawStatus === 'succeeded' ? 'succeeded' :
      rawStatus === 'failed'    ? 'failed'    :
      rawStatus === 'canceled'  ? 'canceled'  :
      'processing';

    const isFinished = status === 'succeeded';
    return {
      predictionId: data.request_id ?? data.id ?? predictionId,
      status,
      videoUrl: isFinished ? (data.video?.url ?? data.result_url) : undefined,
      error:    data.error,
    };
  }
}
