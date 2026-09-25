import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';
import { checkCredits, deductCredit } from '@/lib/credits';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creditCheck = await checkCredits(session.user.id, 'image', 1, 'replicate');
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: creditCheck.reason ?? 'Insufficient credits' }, { status: 402 });
  }

  try {
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

    console.log('[inpaint] Uploading image and mask to Vercel Blob...');

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBlob = await put(`studio/inpaint/${Date.now()}-src.png`, imageBuffer, {
      access: 'public',
      contentType: image.type || 'image/png',
    });
    console.log('[inpaint] Image uploaded:', imageBlob.url);

    const maskBuffer = Buffer.from(await mask.arrayBuffer());
    const maskBlob = await put(`studio/inpaint/${Date.now()}-mask.png`, maskBuffer, {
      access: 'public',
      contentType: 'image/png',
    });
    console.log('[inpaint] Mask uploaded:', maskBlob.url);

    console.log('[inpaint] Calling Flux Fill Pro with prompt:', prompt || '(empty - remove mode)');

    const replicate = new Replicate({ auth: token });

    const output = await replicate.run('black-forest-labs/flux-fill-pro', {
      input: {
        image: imageBlob.url,
        mask: maskBlob.url,
        prompt: prompt || 'clean natural background, seamless fill',
        guidance: Math.max(2, Math.min(5, guidance)),
        steps: Math.max(1, Math.min(50, steps)),
        output_format: 'jpg',
      },
    });

    console.log('[inpaint] Replicate output type:', typeof output, Array.isArray(output) ? 'array' : '');

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

    console.log('[inpaint] Got result URL, re-uploading to blob storage...');

    const imgRes = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBlob = await put(`studio/inpaint/${Date.now()}-result.webp`, imgBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    console.log('[inpaint] Done:', finalBlob.url);
    await deductCredit(session.user.id, 'image', 1, 'replicate');
    const capturedUrl = finalBlob.url;
    createJob({
      userId:       session.user.id,
      predictionId: `inpaint:${Date.now()}`,
      type:         'ai-edit',
      creditType:   'image',
      creditAmount: 1,
      metadata:     { prompt, modelUsed: 'flux-fill-pro', provider: 'replicate' },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => {
      console.error('[inpaint] Failed to save to StudioJob:', err);
    });
    return NextResponse.json({ url: finalBlob.url });
  } catch (error) {
    console.error('[inpaint] Error:', error);
    const message = error instanceof Error ? error.message : 'Inpaint failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
