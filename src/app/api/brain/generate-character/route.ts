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
      reference_image?: string;
      style?: string;
      aspect_ratio?: string;
    };

    const { prompt, reference_image } = body;

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

    // Step 1: fofr/consistent-character — generate the scene with character.
    // Version hash required — community models need /v1/predictions (not /v1/models/) endpoint.
    const sceneOutput = await replicate.run('fofr/consistent-character:9c77a3c2f884193fcee4d89645f02a0b9def9434f9e03cb98460456b831c8772', {
      input: {
        subject:                   reference_image,
        prompt:                    prompt,
        negative_prompt:           'deformed, ugly, disfigured, bad anatomy, blurry, low quality, watermark, nsfw',
        number_of_outputs:         1,
        number_of_images_per_pose: 1,
        output_format:             'webp',
        output_quality:            85,
        randomise_poses:           false,
      },
    });

    const sceneUrls = sceneOutput as unknown[];
    const sceneFirst = sceneUrls?.[0];
    let sceneImageUrl: string | null = null;

    if (typeof sceneFirst === 'string') sceneImageUrl = sceneFirst;
    else if (sceneFirst && typeof (sceneFirst as { url?: () => string | URL }).url === 'function') {
      const r = (sceneFirst as { url: () => string | URL }).url();
      sceneImageUrl = r instanceof URL ? r.toString() : r;
    } else if (sceneFirst instanceof URL) {
      sceneImageUrl = sceneFirst.toString();
    }

    if (!sceneImageUrl) {
      return NextResponse.json({ error: 'Step 1 (scene generation) returned no image URL' }, { status: 500 });
    }

    // Step 2: lucataco/faceswap — paste the real face onto the generated scene.
    // swap_image = real uploaded face, target_image = generated scene.
    const swapOutput = await replicate.run('lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d', {
      input: {
        swap_image:   reference_image,
        target_image: sceneImageUrl,
      },
    });

    let imageUrl: string | null = null;
    if (typeof swapOutput === 'string') imageUrl = swapOutput;
    else if (swapOutput && typeof (swapOutput as { url?: () => string | URL }).url === 'function') {
      const r = (swapOutput as { url: () => string | URL }).url();
      imageUrl = r instanceof URL ? r.toString() : r;
    } else if (swapOutput instanceof URL) {
      imageUrl = swapOutput.toString();
    }

    // Fallback: if faceswap fails, use the scene image without swap
    if (!imageUrl) imageUrl = sceneImageUrl;

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const blob = await put(`brain/character/${Date.now()}.webp`, buffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({
      url: blob.url,
      media: { type: 'image', url: blob.url },
      prompt,
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
