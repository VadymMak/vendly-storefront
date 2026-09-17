import crypto from 'crypto';
import type {
  CameraMotion,
  CameraType,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoProvider,
} from './provider';
import { VideoProviderError } from './provider';

const KLING_API = 'https://api.klingai.com';

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

/** HMAC-SHA256 JWT — no external packages needed. */
function generateKlingJWT(accessKey: string, secretKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
    iat: now,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed';

function toStatus(raw: KlingTaskStatus | string): VideoGenerationStatus {
  switch (raw) {
    case 'succeed':    return 'succeeded';
    case 'failed':     return 'failed';
    case 'processing': return 'processing';
    default:           return 'starting';
  }
}

interface KlingTaskResponse {
  code:    number;
  message: string;
  data: {
    task_id:          string;
    task_status:      KlingTaskStatus;
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{ id: string; url: string; duration: string }>;
    };
  };
}

/**
 * Kling Official API provider (direct — no Replicate).
 * apiKey must be "accessKey:secretKey" (two halves joined by colon).
 */
export class KlingDirectProvider implements VideoProvider {
  async createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult> {
    const [accessKey, secretKey] = apiKey.split(':');
    if (!accessKey || !secretKey) {
      throw new VideoProviderError('Invalid Kling key format — expected "accessKey:secretKey"', 400);
    }
    const jwt = generateKlingJWT(accessKey, secretKey);

    const prompt = req.camera
      ? `${req.prompt}${buildCameraFragment(req.camera)}`
      : req.prompt;

    const body: Record<string, unknown> = {
      model_name: 'kling-v2-6',
      prompt,
      duration:   String(req.duration ?? 5),
      mode:       req.mode === 'pro' ? 'pro' : 'std',
    };
    if (req.startImage)     body.image           = req.startImage;
    if (req.aspectRatio)    body.aspect_ratio    = req.aspectRatio;
    if (req.negativePrompt) body.negative_prompt = req.negativePrompt;

    const res = await fetch(`${KLING_API}/v1/videos/image2video`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as KlingTaskResponse;

    if (!res.ok || data.code !== 0) {
      throw new VideoProviderError(
        `Kling Direct error: ${data.message ?? res.statusText}`,
        res.status === 401 ? 401 : 502,
      );
    }

    return {
      predictionId: data.data.task_id,
      status:       toStatus(data.data.task_status),
    };
  }

  async pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult> {
    const [accessKey, secretKey] = apiKey.split(':');
    if (!accessKey || !secretKey) {
      throw new VideoProviderError('Invalid Kling key format', 400);
    }
    const jwt = generateKlingJWT(accessKey, secretKey);

    const res = await fetch(`${KLING_API}/v1/videos/image2video/${predictionId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      next:    { revalidate: 0 },
    });

    const data = await res.json() as KlingTaskResponse;

    if (!res.ok || data.code !== 0) {
      throw new VideoProviderError(
        `Kling Direct poll error: ${data.message ?? res.statusText}`,
        502,
      );
    }

    const { task_status, task_result, task_status_msg } = data.data;
    const status = toStatus(task_status);
    const videos = task_result?.videos ?? [];

    return {
      predictionId,
      status,
      videoUrl: status === 'succeeded' && videos.length > 0 ? videos[0].url : undefined,
      error:    status === 'failed' ? (task_status_msg ?? 'Kling generation failed') : undefined,
    };
  }

  getModelName():    string { return 'kling-v2.6-direct'; }
  getDisplayName():  string { return 'Kling v2.6 (Direct)'; }
  getCostEstimate(): string { return '$0.50-1.00'; }
}
