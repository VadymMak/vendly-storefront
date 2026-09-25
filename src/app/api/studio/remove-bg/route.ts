import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';
import { checkCredits, deductCredit } from '@/lib/credits';

export const maxDuration = 60;

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

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    console.log('[remove-bg] Uploading image to Vercel Blob...');

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBlob = await put(`studio/remove-bg/${Date.now()}-src.png`, imageBuffer, {
      access: 'public',
      contentType: image.type || 'image/png',
    });
    console.log('[remove-bg] Image uploaded:', imageBlob.url);

    const replicate = new Replicate({ auth: token });

    console.log('[remove-bg] Calling lucataco/remove-bg...');
    const output = await replicate.run('lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1', {
      input: {
        image: imageBlob.url,
      },
    });

    console.log('[remove-bg] Output type:', typeof output);

    let resultUrl: string | null = null;

    if (typeof output === 'string') {
      resultUrl = output;
    } else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
      const result = (output as { url: () => string | URL }).url();
      resultUrl = result instanceof URL ? result.toString() : result;
    } else if (output instanceof URL) {
      resultUrl = output.toString();
    }

    if (!resultUrl) {
      console.error('[remove-bg] Unexpected output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
    }

    console.log('[remove-bg] Re-uploading result...');
    const imgRes = await fetch(resultUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBlob = await put(`studio/remove-bg/${Date.now()}-result.png`, imgBuffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log('[remove-bg] Done:', finalBlob.url);
    await deductCredit(session.user.id, 'image', 1, 'replicate');
    const capturedUrl = finalBlob.url;
    createJob({
      userId:       session.user.id,
      predictionId: `remove-bg:${Date.now()}`,
      type:         'remove-bg',
      creditType:   'image',
      creditAmount: 1,
      metadata:     { modelUsed: 'remove-bg', provider: 'replicate' },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => {
      console.error('[remove-bg] Failed to save to StudioJob:', err);
    });
    return NextResponse.json({ url: finalBlob.url });
  } catch (error) {
    console.error('[remove-bg] Error:', error);
    const message = error instanceof Error ? error.message : 'Remove background failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
