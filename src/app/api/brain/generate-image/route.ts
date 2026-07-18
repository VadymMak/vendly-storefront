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
      provider?: string;
      aspect_ratio?: string;
    };

    const { prompt, provider = 'flux', aspect_ratio = '1:1' } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    let imageUrl: string | null = null;

    if (provider === 'flux-dev') {
      const output = await replicate.run('black-forest-labs/flux-dev', {
        input: {
          prompt,
          aspect_ratio,
          num_inference_steps: 50,
          guidance_scale: 3.5,
          output_format: 'webp',
          output_quality: 85,
        },
      });
      const urls = output as unknown[];
      const first = urls?.[0];
      if (typeof first === 'string') imageUrl = first;
      else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
        const r = (first as { url: () => string | URL }).url();
        imageUrl = r instanceof URL ? r.toString() : r;
      } else if (first instanceof URL) {
        imageUrl = first.toString();
      }
    } else {
      // Default: Flux Schnell
      const output = await replicate.run('black-forest-labs/flux-schnell', {
        input: {
          prompt,
          aspect_ratio,
          output_format: 'webp',
          num_outputs: 1,
        },
      });
      const urls = output as unknown[];
      const first = urls?.[0];
      if (typeof first === 'string') imageUrl = first;
      else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
        const r = (first as { url: () => string | URL }).url();
        imageUrl = r instanceof URL ? r.toString() : r;
      } else if (first instanceof URL) {
        imageUrl = first.toString();
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
    }

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/gen/${Date.now()}.webp`, buffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url: blob.url,
      media: { type: 'image', url: blob.url },
      prompt,
      provider,
    });
  } catch (error) {
    console.error('[brain/generate-image]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
