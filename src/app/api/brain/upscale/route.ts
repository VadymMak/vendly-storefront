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
      image_url?: string;
      scale?: number;
      face_enhance?: boolean;
    };

    const { image_url, scale = 2, face_enhance = false } = body;

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    // Schema default is 4; cap to [2, 4] to avoid GPU OOM
    const safeScale = Math.min(Math.max(Number(scale), 2), 4);

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    const output = await replicate.run('nightmareai/real-esrgan', {
      input: {
        image: image_url,
        scale: safeScale,
        face_enhance,
      },
    });

    let resultUrl: string | null = null;
    if (typeof output === 'string') resultUrl = output;
    else if (output instanceof URL) resultUrl = output.toString();
    else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
      const r = (output as { url: () => string | URL }).url();
      resultUrl = r instanceof URL ? r.toString() : r;
    } else if (Array.isArray(output)) {
      const first = (output as unknown[])[0];
      if (typeof first === 'string') resultUrl = first;
      else if (first instanceof URL) resultUrl = first.toString();
    }

    if (!resultUrl) {
      return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
    }

    const imgRes = await fetch(resultUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/upscale/${Date.now()}.webp`, buffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url: blob.url,
      media: { type: 'image', url: blob.url },
      scale: safeScale,
      original: image_url,
    });
  } catch (error) {
    console.error('[brain/upscale]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
