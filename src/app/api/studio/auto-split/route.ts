import { NextRequest, NextResponse } from 'next/server';
import { createFalClient } from '@fal-ai/client';
import { put } from '@/lib/storage';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { getOrCreateCredits } from '@/lib/credits';
import { fetchAllowedImage, isAllowedImageUrl, SafeFetchError, MAX_INPUT_PIXELS } from '@/lib/studio/safe-fetch';

export const maxDuration = 120;

const MAX_CUTOUTS = 12;
// SAM2 auto-segment masks EVERYTHING (table, wall, shadows, plate rims). Keep likely objects:
const MIN_COVERAGE = 0.005;      // below: micro-noise
const MAX_COVERAGE = 0.5;        // above: background / surface
const BORDER_MARGIN_PX = 5;      // "touches the edge" tolerance
const MAX_BORDERS_TOUCHED = 2;   // 3+ edges touched: surface or backdrop, not a product
const EDGE_FEATHER_SIGMA = 1.5;  // soft alpha instead of jagged binary edges

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
    const body = await req.json() as { imageUrl?: unknown; maxObjects?: unknown };
    const { imageUrl } = body;
    const maxObjects = typeof body.maxObjects === 'number' && Number.isFinite(body.maxObjects)
      ? Math.max(1, Math.min(MAX_CUTOUTS, Math.floor(body.maxObjects)))
      : MAX_CUTOUTS;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    // Validate before calling SAM2 — the paid Fal call must not run on arbitrary URLs
    if (!isAllowedImageUrl(imageUrl)) {
      return NextResponse.json({ error: 'Image URL not allowed' }, { status: 403 });
    }

    // Free feature, but each call hits paid Fal SAM2 — cap per plan like remove-bg
    const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const credits  = await getOrCreateCredits(session.user.id);
    const planType = (credits.planType ?? 'free') as keyof typeof RATE_LIMITS.removeBg;
    const rateLimit = RATE_LIMITS.removeBg[planType] ?? RATE_LIMITS.removeBg.free;

    if (!(await checkRateLimitWithBypass(`auto-split:${ip}:${session.user.id}`, rateLimit, session.user.id))) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 });
    }

    const fal = createFalClient({ credentials: falKey });

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
    const { buffer: origBuffer } = await fetchAllowedImage(imageUrl);
    const origMeta = await sharp(origBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    const origW = origMeta.width!;
    const origH = origMeta.height!;
    const totalPixels = origW * origH;

    // 3) Filter junk masks, measured on each mask's own pixels
    interface MaskInfo { mask: Buffer; coverage: number; borders: number }
    const candidates: MaskInfo[] = [];

    for (const mask of masks.filter((m: FalMask) => m.url).slice(0, 20)) {
      try {
        const { buffer: maskBuffer } = await fetchAllowedImage(mask.url);

        const maskMeta = await sharp(maskBuffer).metadata();
        const maskResized = (maskMeta.width !== origW || maskMeta.height !== origH)
          ? await sharp(maskBuffer).resize(origW, origH, { fit: 'fill' }).toBuffer()
          : maskBuffer;

        const grayscale = await sharp(maskResized).grayscale().raw().toBuffer();
        let whitePixels = 0;
        let minX = origW, minY = origH, maxX = -1, maxY = -1;
        for (let i = 0; i < grayscale.length; i++) {
          if (grayscale[i] > 128) {
            whitePixels++;
            const x = i % origW;
            const y = (i - x) / origW;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        if (whitePixels === 0) continue;

        const borders =
          (minX <= BORDER_MARGIN_PX ? 1 : 0) +
          (minY <= BORDER_MARGIN_PX ? 1 : 0) +
          (maxX >= origW - 1 - BORDER_MARGIN_PX ? 1 : 0) +
          (maxY >= origH - 1 - BORDER_MARGIN_PX ? 1 : 0);
        candidates.push({ mask: maskResized, coverage: whitePixels / totalPixels, borders });
      } catch (e) {
        console.warn('[auto-split] Failed to process mask:', e);
      }
    }

    let kept = candidates.filter((c) =>
      c.coverage >= MIN_COVERAGE && c.coverage <= MAX_COVERAGE && c.borders <= MAX_BORDERS_TOUCHED,
    );
    // A close-up of a single product fills the frame and touches the edges — rather than
    // returning nothing, keep the largest mask that isn't the whole backdrop
    if (kept.length === 0) {
      const fallback = candidates
        .filter((c) => c.coverage >= MIN_COVERAGE && c.coverage <= 0.85)
        .sort((a, b) => b.coverage - a.coverage)[0];
      if (fallback) kept = [fallback];
    }
    console.log(`[auto-split] SAM2 masks ${masks.length} → candidates ${candidates.length} → kept ${kept.length}`);

    if (kept.length === 0) {
      return NextResponse.json({ error: 'No objects detected' }, { status: 422 });
    }

    // Largest objects first — the main products lead the list
    const validMasks = kept.sort((a, b) => b.coverage - a.coverage).map((c) => c.mask);

    // 4) Apply each mask → transparent PNG cutout with feathered edges
    const origRGBA = await sharp(origBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).ensureAlpha().raw().toBuffer();
    const cutoutUrls: string[] = [];

    for (let i = 0; i < Math.min(validMasks.length, maxObjects); i++) {
      // Slightly blurred mask = soft alpha ramp at the edge (no staircase)
      const softAlpha = await sharp(validMasks[i]).grayscale().blur(EDGE_FEATHER_SIGMA).raw().toBuffer();

      const cutoutRGBA = Buffer.alloc(origW * origH * 4);
      for (let px = 0; px < origW * origH; px++) {
        const a = softAlpha[px];
        if (a > 0) {
          cutoutRGBA[px * 4 + 0] = origRGBA[px * 4 + 0];
          cutoutRGBA[px * 4 + 1] = origRGBA[px * 4 + 1];
          cutoutRGBA[px * 4 + 2] = origRGBA[px * 4 + 2];
          cutoutRGBA[px * 4 + 3] = a;
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
    if (error instanceof SafeFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[auto-split] Error:', error);
    return NextResponse.json({ error: 'Auto split failed' }, { status: 500 });
  }
}
