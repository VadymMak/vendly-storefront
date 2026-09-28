import sharp from 'sharp';
import type { EnhanceOutput, SharpEnhanceParams } from '@/lib/types';

/**
 * Deterministic photo enhancement pipeline using Sharp.
 * No AI — just professional-grade photo correction.
 * Runs server-side, ~100-300ms for a typical photo.
 * Outputs JPEG, or PNG when the input has transparency (e.g. cutouts).
 */
export async function enhanceDeterministic(
  inputBuffer: Buffer,
  params: SharpEnhanceParams,
): Promise<EnhanceOutput> {
  const { hasAlpha } = await sharp(inputBuffer).metadata();

  // 0. Apply EXIF orientation — re-encoding strips it, so phone photos would come out sideways
  let pipeline = sharp(inputBuffer).rotate();

  // 1. Auto-normalize (stretch histogram for better dynamic range)
  if (params.normalize) {
    pipeline = pipeline.normalize();
  }

  // 2. Gamma correction (lift shadows, control midtones)
  if (params.gamma !== 2.2) {
    pipeline = pipeline.gamma(params.gamma);
  }

  // 3. Brightness, saturation, lightness (HSL adjustments)
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

  // 4. Contrast via linear transform: output = input * contrast + offset
  if (params.contrast !== 1.0) {
    const offset = 128 * (1 - params.contrast);
    pipeline = pipeline.linear(params.contrast, offset);
  }

  // 5. Warmth via tint (shift red/blue balance)
  if (params.warmth !== 0) {
    const r = Math.max(0, Math.min(255, 128 + params.warmth));
    const b = Math.max(0, Math.min(255, 128 - params.warmth));
    pipeline = pipeline.tint({ r, g: 128, b });
  }

  // 6. CLAHE — local contrast enhancement (makes textures pop)
  if (params.claheWidth > 0) {
    pipeline = pipeline.clahe({
      width: params.claheWidth,
      height: params.claheWidth,
      maxSlope: params.claheMaxSlope,
    });
  }

  // 7. Sharpening (unsharp mask)
  if (params.sharpen > 0) {
    pipeline = pipeline.sharpen({
      sigma: params.sharpen,
    });
  }

  if (hasAlpha) {
    const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return { buffer, contentType: 'image/png', ext: 'png' };
  }

  const buffer = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}
