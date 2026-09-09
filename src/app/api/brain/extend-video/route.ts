import { NextRequest, NextResponse } from 'next/server';
import { getVideoProvider, VideoProviderError } from '@/lib/video';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      last_frame_url?: string;
      prompt?: string;
      duration?: number;
      mode?: string;
    };

    const {
      last_frame_url,
      prompt = 'Smooth continuous motion, same scene',
      duration = 5,
      mode = 'standard',
    } = body;

    if (!last_frame_url) {
      return NextResponse.json(
        { error: 'last_frame_url is required. Provide a URL to the last frame of your video.' },
        { status: 400 },
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const safeDuration = [5, 10].includes(Number(duration)) ? Number(duration) : 5;
    const safeMode = mode === 'pro' ? 'pro' : 'standard';

    // Generation is async — returns a prediction id for polling.
    // startImage feeds the last frame so the new segment starts seamlessly.
    const prediction = await getVideoProvider().createVideo({
      prompt,
      startImage:     last_frame_url,
      duration:       safeDuration,
      mode:           safeMode,
      negativePrompt: 'camera cut, scene change, different location, jump cut',
    }, replicateToken);

    const origin = req.nextUrl.origin;
    return NextResponse.json({
      jobId:          prediction.predictionId,
      status:         'started',
      pollUrl:        `${origin}/api/brain/extend-video/poll?id=${prediction.predictionId}`,
      last_frame_url,
      prompt,
      duration:       safeDuration,
    });
  } catch (error) {
    console.error('[brain/extend-video]', error);
    if (error instanceof VideoProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
