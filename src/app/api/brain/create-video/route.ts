import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider, resolveCamera, VideoProviderError } from '@/lib/video';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

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

    const validDuration = duration === 10 ? 10 : 5;
    const validRatios = ['9:16', '1:1', '16:9'] as const;
    const validAspect = validRatios.includes(aspect_ratio as typeof validRatios[number])
      ? (aspect_ratio as string)
      : '9:16';

    const camera = resolveCamera(camera_type, camera_value);

    const prediction = await getVideoProvider().createVideo({
      prompt,
      startImage:  image_url,
      duration:    validDuration,
      aspectRatio: validAspect,
      mode:        'standard',
      camera,
    }, replicateToken);

    return NextResponse.json({
      jobId: prediction.predictionId,
      status: 'started',
      // TODO(wan): Replicate-specific poll URL — route through the provider once Wan lands.
      pollUrl: `https://api.replicate.com/v1/predictions/${prediction.predictionId}`,
      camera,
    });
  } catch (error) {
    console.error('[brain/create-video]', error);
    if (error instanceof VideoProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
