import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

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
    const replicate = new Replicate({ auth: replicateToken });
    const prediction = await replicate.predictions.get(id);

    if (prediction.status === 'failed') {
      return NextResponse.json(
        { status: 'failed', error: prediction.error, jobId: id },
        { status: 500 },
      );
    }

    if (prediction.status !== 'succeeded') {
      return NextResponse.json({ status: prediction.status, jobId: id });
    }

    // Extract video URL from succeeded prediction
    const output = prediction.output as unknown;
    let videoUrl: string | null = null;

    if (typeof output === 'string') {
      videoUrl = output;
    } else if (output instanceof URL) {
      videoUrl = output.toString();
    } else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
      const r = (output as { url: () => string | URL }).url();
      videoUrl = r instanceof URL ? r.toString() : r;
    } else if (Array.isArray(output)) {
      const first = (output as unknown[])[0];
      if (typeof first === 'string') videoUrl = first;
      else if (first instanceof URL) videoUrl = first.toString();
      else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
        const r = (first as { url: () => string | URL }).url();
        videoUrl = r instanceof URL ? r.toString() : r;
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'No video URL in output', jobId: id }, { status: 500 });
    }

    const videoRes = await fetch(videoUrl);
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
