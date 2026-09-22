import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import sharp from 'sharp';

export const maxDuration = 120;

interface FalMask {
  url: string;
  width?: number;
  height?: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as { imageUrl?: unknown };
    const { imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 });
    }

    fal.config({ credentials: falKey });

    // 1) SAM2 auto-segment
    console.log('[auto-split] Calling SAM2 auto-segment...');
    const result = await fal.subscribe('fal-ai/sam2/auto-segment', {
      input: {
        image_url:              imageUrl,
        output_format:          'png',
        points_per_side:        32,
        pred_iou_thresh:        0.86,
        stability_score_thresh: 0.92,
        min_mask_region_area:   2000,
      },
    });

    const data = result.data as { individual_masks?: FalMask[] };
    const masks = data?.individual_masks;
    if (!masks || !Array.isArray(masks) || masks.length === 0) {
      return NextResponse.json({ error: 'No objects detected' }, { status: 422 });
    }

    console.log(`[auto-split] SAM2 returned ${masks.length} masks`);

    // 2) Download original image
    const origRes = await fetch(imageUrl);
    const origBuffer = Buffer.from(await origRes.arrayBuffer());
    const origMeta = await sharp(origBuffer).metadata();
    const origW = origMeta.width!;
    const origH = origMeta.height!;

    // 3) For each mask: apply to original → transparent PNG cutout
    const sortedMasks = masks
      .filter((m: FalMask) => m.url)
      .slice(0, 8);

    const cutoutUrls: string[] = [];

    for (let i = 0; i < sortedMasks.length; i++) {
      const mask = sortedMasks[i];

      // Download mask (black/white PNG)
      const maskRes = await fetch(mask.url);
      const maskBuffer = Buffer.from(await maskRes.arrayBuffer());

      // Resize mask to match original if dimensions differ
      const maskMeta = await sharp(maskBuffer).metadata();
      const maskResized = (maskMeta.width !== origW || maskMeta.height !== origH)
        ? await sharp(maskBuffer).resize(origW, origH, { fit: 'fill' }).toBuffer()
        : maskBuffer;

      // Extract grayscale mask → use as alpha
      const maskGrayscale = await sharp(maskResized).grayscale().raw().toBuffer();

      // Original as raw RGBA
      const origRGBA = await sharp(origBuffer).ensureAlpha().raw().toBuffer();

      // Apply mask as alpha channel
      const cutoutRGBA = Buffer.alloc(origW * origH * 4);
      for (let px = 0; px < origW * origH; px++) {
        cutoutRGBA[px * 4 + 0] = origRGBA[px * 4 + 0];
        cutoutRGBA[px * 4 + 1] = origRGBA[px * 4 + 1];
        cutoutRGBA[px * 4 + 2] = origRGBA[px * 4 + 2];
        cutoutRGBA[px * 4 + 3] = maskGrayscale[px];
      }

      // Trim transparent border + encode PNG
      const cutoutPng = await sharp(cutoutRGBA, {
        raw: { width: origW, height: origH, channels: 4 },
      })
        .trim()
        .png()
        .toBuffer();

      // Upload to Vercel Blob
      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const blob = await put(
        `studio/auto-split/${session.user.id}/${uniqueId}-part${i}.png`,
        cutoutPng,
        { access: 'public', contentType: 'image/png' },
      );

      cutoutUrls.push(blob.url);
      console.log(`[auto-split] Part ${i + 1}/${sortedMasks.length}: ${blob.url}`);
    }

    return NextResponse.json({ cutouts: cutoutUrls, count: cutoutUrls.length });
  } catch (error) {
    console.error('[auto-split] Error:', error);
    const message = error instanceof Error ? error.message : 'Auto split failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
