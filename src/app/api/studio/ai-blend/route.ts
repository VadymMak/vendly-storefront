import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { checkCredits, consumeCredits } from '@/lib/credits';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creditCheck = await checkCredits(session.user.id, 'image', 1);
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
  }

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

    const maskBuffer = Buffer.from(await mask.arrayBuffer());
    const maskBlob = await put(
      `studio/ai-blend/${Date.now()}-mask.png`,
      maskBuffer,
      { access: 'public', contentType: 'image/png' },
    );

    console.log('[ai-blend] Calling Flux Fill Pro...');

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
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
    }

    const imgRes = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBlob = await put(
      `studio/ai-blend/${Date.now()}-result.png`,
      imgBuffer,
      { access: 'public', contentType: 'image/png' },
    );

    const consume = await consumeCredits(session.user.id, 'image', 1);
    if (!consume.success) {
      return NextResponse.json({ error: consume.reason ?? 'Insufficient credits' }, { status: 402 });
    }

    console.log('[ai-blend] Done:', finalBlob.url);
    return NextResponse.json({ url: finalBlob.url });
  } catch (error) {
    console.error('[ai-blend] Error:', error);
    return NextResponse.json({ error: 'AI blend failed. Please try again.' }, { status: 500 });
  }
}
