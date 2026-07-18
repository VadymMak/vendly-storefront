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
  const prompt = formData.get('prompt') as string;
  const referenceImage = formData.get('referenceImage') as File | null;
  const strength = parseFloat((formData.get('strength') as string) || '0.75');
  const aspectRatio = (formData.get('aspectRatio') as string) || '1:1';

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }
  if (!referenceImage) {
    return NextResponse.json({ error: 'Missing referenceImage' }, { status: 400 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  // Upload reference image to Vercel Blob so Replicate can fetch it by URL
  const refBuffer = Buffer.from(await referenceImage.arrayBuffer());
  const refBlob = await put(`studio/ref/${Date.now()}.webp`, refBuffer, {
    access: 'public',
    contentType: referenceImage.type || 'image/webp',
  });

  const replicate = new Replicate({ auth: token });

  const output = await replicate.run('black-forest-labs/flux-dev', {
    input: {
      prompt,
      image: refBlob.url,
      prompt_strength: Math.max(0.1, Math.min(1.0, strength)),
      num_inference_steps: 50,
      guidance_scale: 3.5,
      aspect_ratio: aspectRatio,
      output_format: 'webp',
      output_quality: 85,
    },
  });

  // Replicate returns an array of FileOutput objects or URL strings
  const urls = output as unknown[];
  const first = urls?.[0];

  let imageUrl: string | null = null;
  if (typeof first === 'string') {
    imageUrl = first;
  } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
    const result = (first as { url: () => string | URL }).url();
    imageUrl = result instanceof URL ? result.toString() : result;
  } else if (first instanceof URL) {
    imageUrl = first.toString();
  }

  if (!imageUrl) {
    console.error('[generate-with-reference] Unexpected Replicate output:', JSON.stringify(output));
    return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
  }

  // Fetch from Replicate CDN and re-upload to our blob storage for permanence
  const imgRes = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  const finalBlob = await put(`studio/chat/${Date.now()}-ref-gen.webp`, imgBuffer, {
    access: 'public',
    contentType: 'image/webp',
  });

  return NextResponse.json({ url: finalBlob.url });
}
