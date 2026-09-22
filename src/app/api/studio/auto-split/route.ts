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
    const totalPixels = origW * origH;

    // 3) Filter: only skip micro-noise (<0.5% of image area)
    // Upper limit intentionally removed — let user delete unwanted objects
    const MIN_COVERAGE = 0.005;

    const validMasks: Buffer[] = [];

    for (const mask of masks.filter((m: FalMask) => m.url).slice(0, 20)) {
      try {
        const maskRes = await fetch(mask.url);
        const maskBuffer = Buffer.from(await maskRes.arrayBuffer());

        const maskMeta = await sharp(maskBuffer).metadata();
        const maskResized = (maskMeta.width !== origW || maskMeta.height !== origH)
          ? await sharp(maskBuffer).resize(origW, origH, { fit: 'fill' }).toBuffer()
          : maskBuffer;

        const grayscale = await sharp(maskResized).grayscale().raw().toBuffer();
        let whitePixels = 0;
        for (let i = 0; i < grayscale.length; i++) {
          if (grayscale[i] > 128) whitePixels++;
        }

        const coverage = whitePixels / totalPixels;

        if (coverage < MIN_COVERAGE) {
          console.log(`[auto-split] Skip micro-noise: ${(coverage * 100).toFixed(2)}%`);
          continue;
        }

        console.log(`[auto-split] Mask accepted: ${(coverage * 100).toFixed(1)}% coverage`);
        validMasks.push(maskResized);
      } catch (e) {
        console.warn('[auto-split] Failed to process mask:', e);
      }
    }

    if (validMasks.length === 0) {
      return NextResponse.json({ error: 'No objects detected' }, { status: 422 });
    }

    console.log(`[auto-split] Processing ${validMasks.length} masks`);

    // 4) Apply each mask → transparent PNG cutout (max 12)
    const origRGBA = await sharp(origBuffer).ensureAlpha().raw().toBuffer();
    const cutoutUrls: string[] = [];

    for (let i = 0; i < Math.min(validMasks.length, 12); i++) {
      const maskGrayscale = await sharp(validMasks[i]).grayscale().raw().toBuffer();

      // Binary alpha: >128 → fully opaque, else fully transparent
      const cutoutRGBA = Buffer.alloc(origW * origH * 4);
      for (let px = 0; px < origW * origH; px++) {
        if (maskGrayscale[px] > 128) {
          cutoutRGBA[px * 4 + 0] = origRGBA[px * 4 + 0];
          cutoutRGBA[px * 4 + 1] = origRGBA[px * 4 + 1];
          cutoutRGBA[px * 4 + 2] = origRGBA[px * 4 + 2];
          cutoutRGBA[px * 4 + 3] = 255;
        }
      }

      // Trim transparent border + encode PNG
      const cutoutPng = await sharp(cutoutRGBA, {
        raw: { width: origW, height: origH, channels: 4 },
      })
        .trim()
        .png()
        .toBuffer();

      // Skip degenerate trimmed results
      const trimMeta = await sharp(cutoutPng).metadata();
      if (!trimMeta.width || !trimMeta.height || trimMeta.width < 20 || trimMeta.height < 20) {
        console.log(`[auto-split] Skip tiny cutout: ${trimMeta.width}×${trimMeta.height}`);
        continue;
      }

      const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const blob = await put(
        `studio/auto-split/${session.user.id}/${uniqueId}-part${i}.png`,
        cutoutPng,
        { access: 'public', contentType: 'image/png' },
      );

      cutoutUrls.push(blob.url);
      console.log(`[auto-split] Part ${i + 1}: ${blob.url} (${trimMeta.width}×${trimMeta.height})`);
    }

    if (cutoutUrls.length === 0) {
      return NextResponse.json({ error: 'No valid cutouts produced' }, { status: 422 });
    }

    return NextResponse.json({ cutouts: cutoutUrls, count: cutoutUrls.length });
  } catch (error) {
    console.error('[auto-split] Error:', error);
    const message = error instanceof Error ? error.message : 'Auto split failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
