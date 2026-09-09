import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getVideoProvider, VideoProviderError } from '@/lib/video';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  try {
    const prediction = await getVideoProvider().pollVideo(id, replicateToken);

    if (prediction.status === 'failed') {
      return NextResponse.json(
        { status: 'failed', error: prediction.error, jobId: id },
        { status: 500 },
      );
    }

    if (prediction.status !== 'succeeded') {
      return NextResponse.json({ status: prediction.status, jobId: id });
    }

    if (!prediction.videoUrl) {
      return NextResponse.json({ error: 'No video URL in output', jobId: id }, { status: 500 });
    }

    const videoRes = await fetch(prediction.videoUrl);
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    const blob = await put(`brain/video-ext/${Date.now()}.mp4`, buffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    return NextResponse.json({
      status: 'succeeded',
      url:    blob.url,
      media:  { type: 'video', url: blob.url },
      jobId:  id,
    });
  } catch (error) {
    console.error('[brain/extend-video/poll]', error);
    if (error instanceof VideoProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
