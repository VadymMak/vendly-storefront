import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      video_url?: string;   // preferred: animated video → sync/lipsync-2
      face_image?: string;  // fallback: static photo → prunaai/p-video-avatar
      audio_url?: string;
    };

    const { video_url, face_image, audio_url } = body;

    if (!audio_url) {
      return NextResponse.json(
        { error: 'audio_url is required. Create a voiceover first.' },
        { status: 400 },
      );
    }
    if (!video_url && !face_image) {
      return NextResponse.json(
        { error: 'Provide video_url (preferred) or face_image.' },
        { status: 400 },
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    let output: unknown;

    if (video_url) {
      // Path A: studio-grade lipsync — video + audio → sync/lipsync-2
      output = await replicate.run('sync/lipsync-2', {
        input: {
          audio: audio_url,
          video: video_url,
        },
      });
    } else {
      // Path B: talking photo fallback — image + audio → p-video-avatar
      output = await replicate.run('prunaai/p-video-avatar', {
        input: {
          image: face_image,
          audio: audio_url,
        },
      });
    }

    // Resolve output URL (handles string, URL, FileOutput, array)
    let videoUrl: string | null = null;
    if (typeof output === 'string') {
      videoUrl = output;
    } else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
      const r = (output as { url: () => string | URL }).url();
      videoUrl = r instanceof URL ? r.toString() : r;
    } else if (output instanceof URL) {
      videoUrl = output.toString();
    } else if (Array.isArray(output)) {
      const first = (output as unknown[])[0];
      if (typeof first === 'string') videoUrl = first;
      else if (first instanceof URL) videoUrl = first.toString();
      else if (first && typeof (first as { url?: () => string }).url === 'function') {
        videoUrl = (first as { url: () => string }).url();
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'No video URL in Replicate response' }, { status: 500 });
    }

    const videoRes = await fetch(videoUrl);
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    const blob = await put(`brain/lipsync/${Date.now()}.mp4`, buffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    return NextResponse.json({
      url:   blob.url,
      media: { type: 'video', url: blob.url },
      mode:  video_url ? 'sync-lipsync-2' : 'p-video-avatar',
    });
  } catch (error) {
    console.error('[brain/lip-sync]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
