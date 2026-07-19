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
      face_image?: string;
      audio_url?: string;
      still_mode?: boolean;
      use_enhancer?: boolean;
    };

    const {
      face_image,
      audio_url,
      still_mode = true,
      use_enhancer = false,
    } = body;

    if (!face_image) {
      return NextResponse.json(
        { error: 'face_image URL is required. Upload a clear face photo first.' },
        { status: 400 },
      );
    }
    if (!audio_url) {
      return NextResponse.json(
        { error: 'audio_url is required. Provide a URL to an mp3 or wav audio file.' },
        { status: 400 },
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    // SadTalker: static face image + audio → talking head video.
    // still_mode requires preprocess='full' to work correctly per model docs.
    const output = await replicate.run('cjwbw/sadtalker', {
      input: {
        source_image:     face_image,
        driven_audio:     audio_url,
        preprocess:       still_mode ? 'full' : 'crop',
        still_mode,
        use_enhancer,
        use_eyeblink:     true,
        size_of_image:    256,
        expression_scale: 1,
        facerender:       'facevid2vid',
        pose_style:       0,
      },
    });

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
      url: blob.url,
      media: { type: 'video', url: blob.url },
      face_image,
      audio_url,
    });
  } catch (error) {
    console.error('[brain/lip-sync]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
