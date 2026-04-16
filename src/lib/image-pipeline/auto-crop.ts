import sharp from 'sharp';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  buffer: Buffer;
  originalWidth: number;
  originalHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  aspectRatio: string;
}

// ─── cropForHero ──────────────────────────────────────────────────────────────

const DEFAULT_ASPECT   = 16 / 9;  // 1.7778
const ASPECT_TOLERANCE = 0.05;

export async function cropForHero(
  imageBuffer: Buffer,
  cropCoords?: CropCoords,
  targetAspect: number = DEFAULT_ASPECT,
): Promise<CropResult> {
  const meta = await sharp(imageBuffer).metadata();
  const originalWidth  = meta.width  ?? 0;
  const originalHeight = meta.height ?? 0;

  let pipeline = sharp(imageBuffer);
  let croppedWidth  = originalWidth;
  let croppedHeight = originalHeight;

  if (cropCoords) {
    // AI-supplied crop — use directly
    pipeline = pipeline.extract({
      left:   cropCoords.x,
      top:    cropCoords.y,
      width:  cropCoords.width,
      height: cropCoords.height,
    });
    croppedWidth  = cropCoords.width;
    croppedHeight = cropCoords.height;
  } else {
    // Auto-calculate based on target aspect ratio
    const currentAspect = originalWidth / originalHeight;
    const diff = Math.abs(currentAspect - targetAspect);

    if (diff >= ASPECT_TOLERANCE) {
      if (currentAspect > targetAspect) {
        // Too wide → trim sides, crop centre horizontally
        croppedWidth = Math.round(originalHeight * targetAspect);
        const left   = Math.round((originalWidth - croppedWidth) / 2);
        pipeline = pipeline.extract({
          left,
          top:    0,
          width:  croppedWidth,
          height: originalHeight,
        });
        croppedHeight = originalHeight;
      } else {
        // Too tall → shift crop upward by 1/3 (faces in upper area)
        croppedHeight = Math.round(originalWidth / targetAspect);
        const top     = Math.round((originalHeight - croppedHeight) / 3);
        pipeline = pipeline.extract({
          left:   0,
          top,
          width:  originalWidth,
          height: croppedHeight,
        });
        croppedWidth = originalWidth;
      }
    }
  }

  // Resize to max 1440px wide (no upscaling)
  pipeline = pipeline.resize({ width: 1440, withoutEnlargement: true });

  const buffer = await pipeline.webp({ quality: 85 }).toBuffer();

  // Read final dimensions after resize
  const finalMeta  = await sharp(buffer).metadata();
  const finalWidth  = finalMeta.width  ?? croppedWidth;
  const finalHeight = finalMeta.height ?? croppedHeight;

  return {
    buffer,
    originalWidth,
    originalHeight,
    croppedWidth:  finalWidth,
    croppedHeight: finalHeight,
    aspectRatio:   '16:9',
  };
}

// ─── cropForOgImage ───────────────────────────────────────────────────────────

export async function cropForOgImage(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer();
}
