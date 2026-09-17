import type {
  CameraMotion,
  CameraType,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoProvider,
} from './provider';
import { VideoProviderError } from './provider';

const MODEL_V26 = 'kwaivgi/kling-v2.6';
const MODEL_V3  = 'kwaivgi/kling-v3-omni-video';

const REPLICATE_API = 'https://api.replicate.com/v1';
const MAX_RETRIES   = 3;

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

// Kling on Replicate has no camera_movement field — we encode it in the prompt instead.
function buildCameraFragment(camera: CameraMotion): string {
  if (camera.type === 'none') return '';
  const intensity = camera.value <= 3 ? 'subtle' : camera.value <= 6 ? 'smooth' : 'dramatic';
  return `, ${CAMERA_PROMPTS[camera.type]}, ${intensity} motion, continuous fluid movement`;
}

/** Retries once per 429, honouring the retry delay Replicate reports in `detail`. */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
    const body   = await res.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (body.detail as string) ?? '';
    const m      = detail.match(/(\d+(?:\.\d+)?)\s*second/i);
    await new Promise((r) => setTimeout(r, m ? Math.ceil(parseFloat(m[1])) * 1000 : 8000));
    attempt++;
  }
}

interface ReplicatePrediction {
  id:      string;
  status:  string;
  output?: unknown;
  error?:  string;
}

function toStatus(raw: string): VideoGenerationStatus {
  switch (raw) {
    case 'succeeded': return 'succeeded';
    case 'failed':    return 'failed';
    case 'canceled':  return 'canceled';
    case 'starting':  return 'starting';
    default:          return 'processing';
  }
}

/** Replicate output is a URL string, an array of them, or an SDK FileOutput-ish object. */
function extractVideoUrl(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
    const r = (output as { url: () => string | URL }).url();
    return r instanceof URL ? r.toString() : r;
  }
  if (Array.isArray(output)) return extractVideoUrl((output as unknown[])[0]);
  return undefined;
}

export class KlingProvider implements VideoProvider {
  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    // v3 handles character reference frames; v2.1 is the cheaper default.
    const useV3 = !!(req.referenceImages && req.referenceImages.length > 0);
    const model = useV3 ? MODEL_V3 : MODEL_V26;

    const prompt = req.camera
      ? `${req.prompt}${buildCameraFragment(req.camera)}`
      : req.prompt;

    const input: Record<string, unknown> = {
      prompt,
      start_image: req.startImage,
      duration:    req.duration,
    };
    if (req.aspectRatio)    input.aspect_ratio    = req.aspectRatio;
    if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
    if (useV3) {
      input.reference_images = req.referenceImages;
      input.mode             = req.mode ?? 'standard';
    } else if (req.mode) {
      input.mode = req.mode;
    }

    const res = await fetchWithRetry(`${REPLICATE_API}/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      const err    = await res.json().catch(() => ({})) as Record<string, unknown>;
      const detail = (err.detail as string) ?? JSON.stringify(err);
      throw new VideoProviderError(`Replicate error: ${detail}`, 502);
    }

    const prediction = await res.json() as ReplicatePrediction;
    const status     = toStatus(prediction.status);

    return {
      predictionId: prediction.id,
      status,
      videoUrl: status === 'succeeded' ? extractVideoUrl(prediction.output) : undefined,
      error:    status === 'failed'    ? prediction.error : undefined,
    };
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next:    { revalidate: 0 },
    });

    if (!res.ok) {
      const err    = await res.json().catch(() => ({})) as Record<string, unknown>;
      const detail = (err.detail as string) ?? JSON.stringify(err);
      throw new VideoProviderError(`Replicate error: ${detail}`, 502);
    }

    const prediction = await res.json() as ReplicatePrediction;
    const status     = toStatus(prediction.status);

    return {
      predictionId: prediction.id ?? predictionId,
      status,
      videoUrl: status === 'succeeded' ? extractVideoUrl(prediction.output) : undefined,
      error:    status === 'failed'    ? prediction.error : undefined,
    };
  }

  getModelName():    string { return MODEL_V26; }
  getDisplayName():  string { return 'Kling v2.6'; }
  getCostEstimate(): string { return '$0.30-0.60'; }
}
