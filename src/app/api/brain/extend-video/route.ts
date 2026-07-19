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

    const replicate = new Replicate({ auth: replicateToken });

    const safeDuration = [5, 10].includes(Number(duration)) ? Number(duration) : 5;
    const safeMode = mode === 'pro' ? 'pro' : 'standard';

    // Kling v2.1 is async — returns prediction.id for polling.
    // start_image feeds the last frame so the new segment starts seamlessly.
    const prediction = await replicate.predictions.create({
      model: 'kwaivgi/kling-v2.1',
      input: {
        prompt,
        start_image:     last_frame_url,
        duration:        safeDuration,
        mode:            safeMode,
        negative_prompt: 'camera cut, scene change, different location, jump cut',
      },
    });

    const origin = req.nextUrl.origin;
    return NextResponse.json({
      jobId:          prediction.id,
      status:         'started',
      pollUrl:        `${origin}/api/brain/extend-video/poll?id=${prediction.id}`,
      last_frame_url,
      prompt,
      duration:       safeDuration,
    });
  } catch (error) {
    console.error('[brain/extend-video]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
