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
      prompt?: string;
      reference_image?: string;
      style?: string;
      aspect_ratio?: string;
    };

    const { prompt, reference_image } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (!reference_image) {
      return NextResponse.json({ error: 'reference_image URL is required' }, { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    // fofr/consistent-character: generates consistent character across scenes.
    // subject = reference photo URL, prompt = scene description.
    const output = await replicate.run('fofr/consistent-character', {
      input: {
        subject:                  reference_image,
        prompt:                   prompt,
        negative_prompt:          'deformed, ugly, disfigured, bad anatomy, blurry, low quality, watermark, nsfw',
        number_of_outputs:        1,
        number_of_images_per_pose: 1,
        output_format:            'webp',
        output_quality:           85,
        randomise_poses:          false,
      },
    });

    const urls = output as unknown[];
    const first = urls?.[0];
    let imageUrl: string | null = null;

    if (typeof first === 'string') imageUrl = first;
    else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
      const r = (first as { url: () => string | URL }).url();
      imageUrl = r instanceof URL ? r.toString() : r;
    } else if (first instanceof URL) {
      imageUrl = first.toString();
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
    }

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/character/${Date.now()}.webp`, buffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url: blob.url,
      media: { type: 'image', url: blob.url },
      prompt,
      reference_image,
    });
  } catch (error) {
    console.error('[brain/generate-character]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
