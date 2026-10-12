import sharp from 'sharp';
import type { EnhanceOutput, SharpEnhanceParams } from '@/lib/types';

/**
 * Deterministic photo enhancement — 3 safe Sharp operations.
 * No CLAHE, no normalize, no gamma, no color matrix.
 * ~50-200ms, deterministic, no AI.
 */
const WEBP_MAX_SIDE = 16383;

export async function enhanceDeterministic(
  inputBuffer: Buffer,
  params: SharpEnhanceParams,
): Promise<EnhanceOutput> {
  const { hasAlpha, width = 0, height = 0 } = await sharp(inputBuffer).metadata();

  let pipeline = sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .toColourspace('srgb');

  // 1. Brightness, saturation, lightness
  if (
    params.brightness !== 1.0 ||
    params.saturation !== 1.0 ||
    params.lightness !== 0
  ) {
    pipeline = pipeline.modulate({
      brightness: params.brightness,
      saturation: params.saturation,
      lightness: params.lightness,
    });
  }

  // 2. Global contrast via linear transform, pivoted around mid-gray (128)
  if (params.contrast !== 1.0) {
    const offset = 128 * (1 - params.contrast);
    pipeline = pipeline.linear(params.contrast, offset);
  }

  // 2.5. Warmth: shift color balance via RGB matrix
  if (params.warmth !== 0) {
    const w = params.warmth / 100;
    pipeline = pipeline.recomb([
      [1 + w * 0.38, w * 0.12, 0],
      [0, 1 + w * 0.12, 0],
      [0, w * 0.05, 1 - w * 0.30],
    ]);
  }

  // 3. Sharpening (unsharp mask with controlled flat/edge params)
  if (params.sharpenSigma > 0) {
    pipeline = pipeline.sharpen({
      sigma: params.sharpenSigma,
      m1: params.sharpenFlat,
      m2: params.sharpenJagged,
      x1: 2.5,
      y2: 8,
      y3: 8,
    });
  }

  if (hasAlpha) {
    const buffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    return { buffer, contentType: 'image/png', ext: 'png' };
  }

  // WebP: smaller than JPEG at the same visual quality (Blob storage is capped at 1 GB).
  // WebP can't encode sides over 16383 px — JPEG for those.
  if (width > WEBP_MAX_SIDE || height > WEBP_MAX_SIDE) {
    const buffer = await pipeline
      .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
    return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
  }
  const buffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
  return { buffer, contentType: 'image/webp', ext: 'webp' };
}
