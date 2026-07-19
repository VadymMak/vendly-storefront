import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

const STYLE_SUFFIXES: Record<string, string> = {
  photorealistic: 'photorealistic, professional photography, high quality',
  anime:          'anime style, vibrant colors, detailed illustration',
  cartoon:        '3D cartoon style, Pixar-like, soft lighting',
  watercolor:     'watercolor painting, artistic, soft edges',
};

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
    };

    const {
      prompt,
      reference_image,
      style = 'photorealistic',
    } = body;

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

    const styleSuffix = STYLE_SUFFIXES[style] ?? STYLE_SUFFIXES.photorealistic;
    const enhancedPrompt = `${prompt}, ${styleSuffix}`;

    // InstantID preserves face identity across different scenes/styles.
    // No width/height params — model uses fixed SDXL dimensions.
    const output = await replicate.run('zsxkib/instant-id', {
      input: {
        image:                        reference_image,
        prompt:                       enhancedPrompt,
        negative_prompt:              'deformed, ugly, disfigured, bad anatomy, blurry, low quality',
        num_inference_steps:          30,
        guidance_scale:               7.5,
        ip_adapter_scale:             0.8,
        controlnet_conditioning_scale: 0.8,
        enhance_nonface_region:       true,
        output_format:                'webp',
        output_quality:               85,
        num_outputs:                  1,
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
      prompt: enhancedPrompt,
      style,
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
