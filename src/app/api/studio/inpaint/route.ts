import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const image = formData.get('image') as File | null;
  const mask = formData.get('mask') as File | null;
  const prompt = (formData.get('prompt') as string) || '';
  const guidance = parseFloat((formData.get('guidance') as string) || '3');
  const steps = parseInt((formData.get('steps') as string) || '50', 10);

  if (!image) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  }
  if (!mask) {
    return NextResponse.json({ error: 'Missing mask' }, { status: 400 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  // Upload image and mask to Vercel Blob so Replicate can fetch them by URL
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const imageBlob = await put(`studio/inpaint/${Date.now()}-src.webp`, imageBuffer, {
    access: 'public',
    contentType: image.type || 'image/webp',
  });

  const maskBuffer = Buffer.from(await mask.arrayBuffer());
  const maskBlob = await put(`studio/inpaint/${Date.now()}-mask.png`, maskBuffer, {
    access: 'public',
    contentType: 'image/png',
  });

  const replicate = new Replicate({ auth: token });

  const output = await replicate.run('black-forest-labs/flux-fill-pro', {
    input: {
      image: imageBlob.url,
      mask: maskBlob.url,
      prompt: prompt || 'natural background fill',
      guidance: Math.max(2, Math.min(5, guidance)),
      steps: Math.max(1, Math.min(50, steps)),
      output_format: 'webp',
    },
  });

  // Flux Fill Pro returns a single URL string or FileOutput
  let imageUrl: string | null = null;

  if (typeof output === 'string') {
    imageUrl = output;
  } else if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
      const result = (first as { url: () => string | URL }).url();
      imageUrl = result instanceof URL ? result.toString() : result;
    } else if (first instanceof URL) {
      imageUrl = first.toString();
    }
  } else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
    const result = (output as { url: () => string | URL }).url();
    imageUrl = result instanceof URL ? result.toString() : result;
  }

  if (!imageUrl) {
    console.error('[inpaint] Unexpected Replicate output:', JSON.stringify(output));
    return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
  }

  // Re-upload result to our blob storage for permanence
  const imgRes = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const finalBlob = await put(`studio/inpaint/${Date.now()}-result.webp`, imgBuffer, {
    access: 'public',
    contentType: 'image/webp',
  });

  return NextResponse.json({ url: finalBlob.url });
}
