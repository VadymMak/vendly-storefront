/**
 * Video provider abstraction.
 *
 * The app generates video through one of several backends (Kling on Replicate,
 * self-hosted Wan 2.2, …). Everything provider-specific lives behind this
 * interface so routes never talk to a vendor SDK directly.
 *
 * Select the active provider with the VIDEO_PROVIDER env var — see ./index.ts.
 */

export type VideoProviderName = 'fal' | 'kling' | 'kling-direct' | 'wan';

/** Camera motion vocabulary — provider-agnostic. */
export const VALID_CAMERA_TYPES = [
  'zoom_in', 'zoom_out',
  'pan_left', 'pan_right',
  'tilt_up', 'tilt_down',
  'orbit_left', 'orbit_right',
  'none',
] as const;

export type CameraType = (typeof VALID_CAMERA_TYPES)[number];

export interface CameraMotion {
  type:  CameraType;
  /** Intensity 0–10. */
  value: number;
}

/**
 * Validate a raw camera type/value pair. Returns null when the type is unknown
 * or absent; the value is clamped to 0–10.
 */
export function resolveCamera(
  type:  string | undefined,
  value: number | undefined,
): CameraMotion | null {
  if (!type || !VALID_CAMERA_TYPES.includes(type as CameraType)) return null;
  return {
    type:  type as CameraType,
    value: Math.min(10, Math.max(0, value ?? 5)),
  };
}

export interface VideoGenerationRequest {
  prompt:           string;
  /** URL of the start frame. Required by every current provider. */
  startImage?:      string;
  /** Seconds — 5 or 10. */
  duration:         number;
  /** '9:16' | '1:1' | '16:9'. Omit to let the provider infer it from startImage. */
  aspectRatio?:     string;
  mode?:            'standard' | 'pro';
  negativePrompt?:  string;
  /** Character reference frames (Kling v3 only for now). */
  referenceImages?: string[];
  /** Camera movement — providers encode it however their model expects. */
  camera?:          CameraMotion | null;
}

export type VideoGenerationStatus =
  | 'starting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface VideoGenerationResult {
  predictionId: string;
  status:       VideoGenerationStatus;
  /** Set only when status is 'succeeded'. */
  videoUrl?:    string;
  /** Set only when status is 'failed'. */
  error?:       string;
}

/** Provider failure carrying the HTTP status a route should surface. */
export class VideoProviderError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name   = 'VideoProviderError';
    this.status = status;
  }
}

export interface VideoProvider {
  createVideo(req: VideoGenerationRequest, apiKey: string): Promise<VideoGenerationResult>;
  pollVideo(predictionId: string, apiKey: string): Promise<VideoGenerationResult>;
  /** Machine-readable model id, e.g. 'kwaivgi/kling-v2.1'. */
  getModelName(): string;
  /** Human-readable label for UI, e.g. 'Kling v2.1'. */
  getDisplayName(): string;
  /** Rough per-video cost for UI, e.g. '$0.30-0.60'. */
  getCostEstimate(): string;
}
