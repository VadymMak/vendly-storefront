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
    const body = (await req.json()) as { image_url?: string };
    const { image_url } = body;

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: replicateToken });

    // lucataco/remove-bg: single input param 'image', returns transparent PNG
    const output = await replicate.run('lucataco/remove-bg', {
      input: { image: image_url },
    });

    const candidate = (Array.isArray(output) ? (output as unknown[])[0] : output) as unknown;
    let resultUrl: string | null = null;

    if (typeof candidate === 'string') resultUrl = candidate;
    else if (candidate instanceof URL) resultUrl = candidate.toString();
    else if (candidate && typeof (candidate as { url?: () => string | URL }).url === 'function') {
      const r = (candidate as { url: () => string | URL }).url();
      resultUrl = r instanceof URL ? r.toString() : r;
    } else if (typeof output === 'string') resultUrl = output;

    if (!resultUrl) {
      return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
    }

    const imgRes = await fetch(resultUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/nobg/${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    return NextResponse.json({
      url: blob.url,
      media: { type: 'image', url: blob.url },
      original: image_url,
    });
  } catch (error) {
    console.error('[brain/remove-bg]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
