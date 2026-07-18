import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

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
    };

    const { prompt, image_url, duration = 5, aspect_ratio = '9:16' } = body;

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

    // Kling v2.1 — async job, returns prediction ID
    const validDuration = duration === 10 ? 10 : 5;
    const validRatios = ['9:16', '1:1', '16:9'] as const;
    const validAspect = validRatios.includes(aspect_ratio as typeof validRatios[number])
      ? (aspect_ratio as string)
      : '9:16';

    const prediction = await replicate.predictions.create({
      model: 'klingai/kling-v2.1-standard',
      input: {
        prompt,
        start_image: image_url,
        duration: validDuration,
        aspect_ratio: validAspect,
        cfg_scale: 0.5,
        mode: 'standard',
      },
    });

    return NextResponse.json({
      jobId: prediction.id,
      status: 'started',
      pollUrl: `https://api.replicate.com/v1/predictions/${prediction.id}`,
    });
  } catch (error) {
    console.error('[brain/create-video]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
