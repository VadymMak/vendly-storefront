import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { checkCredits, consumeCredits, refundCredits } from '@/lib/credits';
import { CREDIT_COSTS } from '@/lib/constants';
import { discardBlobs } from '@/lib/persist-to-blob';
import { createFinishedJob } from '@/lib/studio-jobs';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creditCheck = await checkCredits(session.user.id, 'image', CREDIT_COSTS.aiBlend);
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
  }

  let consume: Awaited<ReturnType<typeof consumeCredits>> | null = null;

  // Input copies exist only for the provider to fetch — deleted once the call is over
  const inputBlobs: string[] = [];

  try {
    const formData = await req.formData();
    const composite = formData.get('composite') as File | null;
    const mask = formData.get('mask') as File | null;
    const prompt = (formData.get('prompt') as string) || '';

    if (!composite) {
      return NextResponse.json({ error: 'Missing composite image' }, { status: 400 });
    }
    if (!mask) {
      return NextResponse.json({ error: 'Missing edge mask' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    console.log('[ai-blend] Uploading composite and mask...');

    const compositeBuffer = Buffer.from(await composite.arrayBuffer());
    const compositeBlob = await put(
      `studio/ai-blend/${Date.now()}-composite.png`,
      compositeBuffer,
      { access: 'public', contentType: 'image/png' },
    );
    inputBlobs.push(compositeBlob.url);

    const maskBuffer = Buffer.from(await mask.arrayBuffer());
    const maskBlob = await put(
      `studio/ai-blend/${Date.now()}-mask.png`,
      maskBuffer,
      { access: 'public', contentType: 'image/png' },
    );
    inputBlobs.push(maskBlob.url);

    console.log('[ai-blend] Calling Flux Fill Pro...');

    // Atomic reserve BEFORE the paid provider call — refunded below if it fails
    consume = await consumeCredits(session.user.id, 'image', CREDIT_COSTS.aiBlend);
    if (!consume.success) {
      return NextResponse.json({ error: consume.reason ?? 'Insufficient credits' }, { status: 402 });
    }

    const replicate = new Replicate({ auth: token });

    const blendPrompt =
      prompt ||
      'seamless natural edge blending, matching lighting and shadows, ' +
        'smooth transition between object edges and background, photorealistic';

    const output = await replicate.run('black-forest-labs/flux-fill-pro', {
      input: {
        image: compositeBlob.url,
        mask: maskBlob.url,
        prompt: blendPrompt,
        guidance: 3,
        steps: 30,
        output_format: 'png',
      },
    });

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
      console.error('[ai-blend] Unexpected output:', JSON.stringify(output));
      if (!consume.byok) {
        await refundCredits(session.user.id, 'image', consume.fromBonus ?? 0, consume.fromMonthly ?? 0);
      }
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
    }

    const imgRes = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBlob = await put(
      `studio/ai-blend/${Date.now()}-result.png`,
      imgBuffer,
      { access: 'public', contentType: 'image/png' },
    );


    console.log('[ai-blend] Done:', finalBlob.url);
    // Show the paid result in My Work; a failed bookkeeping write must not lose the image
    await createFinishedJob({
      userId:       session.user.id,
      type:         'place-products',
      outputUrl:    finalBlob.url,
      creditAmount: CREDIT_COSTS.aiBlend,
      metadata:     { blended: true, modelUsed: 'flux-fill-pro', provider: 'replicate' },
    }).catch((err) => console.error('[ai-blend] Failed to save to StudioJob:', err));
    return NextResponse.json({ url: finalBlob.url });
  } catch (error) {
    console.error('[ai-blend] Error:', error);
    if (consume?.success && !consume.byok) {
      await refundCredits(session.user.id, 'image', consume.fromBonus ?? 0, consume.fromMonthly ?? 0);
    }
    return NextResponse.json({ error: 'AI blend failed. Please try again.' }, { status: 500 });
  } finally {
    void discardBlobs(inputBlobs);
  }
}
