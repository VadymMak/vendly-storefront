import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

const VALID_CAMERA_TYPES = [
  'zoom_in', 'zoom_out',
  'pan_left', 'pan_right',
  'tilt_up', 'tilt_down',
  'orbit_left', 'orbit_right',
  'none',
] as const;

type CameraType = (typeof VALID_CAMERA_TYPES)[number];

// Kling on Replicate has no camera_movement field — we encode it in the prompt instead.
function buildCameraFragment(type: CameraType, value: number): string {
  if (type === 'none') return '';
  const speed = value <= 3 ? 'slowly' : value <= 7 ? 'steadily' : 'quickly';
  const directions: Record<CameraType, string> = {
    zoom_in:     `${speed} zooming in`,
    zoom_out:    `${speed} zooming out`,
    pan_left:    `${speed} panning left`,
    pan_right:   `${speed} panning right`,
    tilt_up:     `${speed} tilting up`,
    tilt_down:   `${speed} tilting down`,
    orbit_left:  `${speed} orbiting left`,
    orbit_right: `${speed} orbiting right`,
    none:        '',
  };
  return `, with camera ${directions[type]}`;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      prompt?: string;
      image_url?: string;
      duration?: number;
      aspect_ratio?: string;
      camera_type?: string;
      camera_value?: number;
    };

    const {
      prompt,
      image_url,
      duration = 5,
      aspect_ratio = '9:16',
      camera_type,
      camera_value = 5,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    const validDuration = duration === 10 ? 10 : 5;
    const validRatios = ['9:16', '1:1', '16:9'] as const;
    const validAspect = validRatios.includes(aspect_ratio as typeof validRatios[number])
      ? (aspect_ratio as string)
      : '9:16';

    const resolvedCameraType =
      camera_type && VALID_CAMERA_TYPES.includes(camera_type as CameraType)
        ? (camera_type as CameraType)
        : null;

    const clampedValue = Math.min(10, Math.max(0, camera_value));
    const cameraFragment = resolvedCameraType
      ? buildCameraFragment(resolvedCameraType, clampedValue)
      : '';

    const finalPrompt = `${prompt}${cameraFragment}`;

    const prediction = await replicate.predictions.create({
      model: 'kwaivgi/kling-v2.1',
      input: {
        prompt: finalPrompt,
        start_image: image_url,
        duration: validDuration,
        aspect_ratio: validAspect,
        mode: 'standard',
      },
    });

    return NextResponse.json({
      jobId: prediction.id,
      status: 'started',
      pollUrl: `https://api.replicate.com/v1/predictions/${prediction.id}`,
      camera: resolvedCameraType
        ? { type: resolvedCameraType, value: clampedValue }
        : null,
    });
  } catch (error) {
    console.error('[brain/create-video]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
