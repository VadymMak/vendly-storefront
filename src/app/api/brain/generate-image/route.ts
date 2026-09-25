import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { grokGenerate } from '@/lib/xai-client';

const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

interface BrainGenerateBody {
  prompt:           string;
  original_prompt?: string;
  provider?:        'flux' | 'grok';
  aspect_ratio?:    string;
  quality?:         'fast' | 'good';
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-brain-api-key');
  if (!BRAIN_API_KEY || apiKey !== BRAIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as BrainGenerateBody;
    const { prompt, provider = 'flux', aspect_ratio = '1:1', quality = 'fast' } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    let imageUrl: string;

    if (provider === 'grok') {
      const xaiKey = process.env.XAI_API_KEY;
      if (!xaiKey) {
        return NextResponse.json({ error: 'xAI API key not configured' }, { status: 500 });
      }
      // grokGenerate(apiKey, prompt) → Promise<string> (URL)
      imageUrl = await grokGenerate(xaiKey, prompt.trim());

    } else {
      const replicateToken = process.env.REPLICATE_API_TOKEN;
      if (!replicateToken) {
        return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
      }

      const replicate = new Replicate({ auth: replicateToken });
      const model = quality === 'good'
        ? 'black-forest-labs/flux-dev'
        : 'black-forest-labs/flux-schnell';

      const output = await replicate.run(model as `${string}/${string}`, {
        input: {
          prompt:        prompt.trim(),
          aspect_ratio,
          output_format: 'webp',
          output_quality: 90,
          ...(quality === 'good' ? { num_inference_steps: 28, guidance_scale: 3.5 } : { num_inference_steps: 4, go_fast: true }),
        },
      });

      let rawUrl: string | null = null;
      const urls = output as unknown[];
      const first = urls?.[0];
      if (typeof first === 'string') {
        rawUrl = first;
      } else if (first instanceof URL) {
        rawUrl = first.toString();
      } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
        const r = (first as { url: () => string | URL }).url();
        rawUrl = r instanceof URL ? r.toString() : r;
      }

      if (!rawUrl) {
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
      }
      imageUrl = rawUrl;
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/generate-image/${Date.now()}.webp`, buffer, {
      access:      'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url:   blob.url,
      media: { type: 'image', url: blob.url },
    });

  } catch (error) {
    console.error('[brain/generate-image]', error);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
