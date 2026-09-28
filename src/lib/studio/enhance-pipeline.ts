import sharp from 'sharp';
import type { EnhanceOutput, SharpEnhanceParams } from '@/lib/types';

/**
 * Deterministic photo enhancement — 3 safe Sharp operations.
 * No CLAHE, no normalize, no gamma, no color matrix.
 * ~50-200ms, deterministic, no AI.
 */
export async function enhanceDeterministic(
  inputBuffer: Buffer,
  params: SharpEnhanceParams,
): Promise<EnhanceOutput> {
  const { hasAlpha } = await sharp(inputBuffer).metadata();

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

  const buffer = await pipeline
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}
