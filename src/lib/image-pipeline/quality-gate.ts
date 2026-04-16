import sharp from 'sharp';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageAnalysis {
  filePath: string;
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  isBlurry: boolean;
  brightness: number;  // 0–255 average greyscale mean
  contrast: number;    // 0–100 derived from stdev
  passed: boolean;
  failReasons: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WIDTH      = 1200;
const MIN_HEIGHT     = 630;
const MIN_SIZE_KB    = 50;
const BLUR_THRESHOLD = 25;   // stdev below this → blurry
const MAX_STDEV      = 128;  // used to normalise contrast to 0–100

// ─── analyzeImageQuality ──────────────────────────────────────────────────────

export async function analyzeImageQuality(
  imageBuffer: Buffer,
  fileName: string,
): Promise<ImageAnalysis> {
  const failReasons: string[] = [];

  // a) Metadata
  const meta = await sharp(imageBuffer).metadata();
  const width  = meta.width  ?? 0;
  const height = meta.height ?? 0;
  const format = meta.format ?? 'unknown';
  const sizeKb = Math.round(imageBuffer.byteLength / 1024);

  // b) Size check
  if (width < MIN_WIDTH) {
    failReasons.push(`Width ${width}px < minimum ${MIN_WIDTH}px`);
  }
  if (height < MIN_HEIGHT) {
    failReasons.push(`Height ${height}px < minimum ${MIN_HEIGHT}px`);
  }

  // c) Blur detection via greyscale stdev
  const greyStats = await sharp(imageBuffer).greyscale().stats();
  const stdev     = greyStats.channels[0]?.stdev ?? 0;
  const isBlurry  = stdev < BLUR_THRESHOLD;
  if (isBlurry) {
    failReasons.push(`Image appears blurry (stdev ${stdev.toFixed(1)} < ${BLUR_THRESHOLD})`);
  }

  // d) Brightness (greyscale mean)
  const brightness = greyStats.channels[0]?.mean ?? 0;

  // e) Contrast (stdev as proxy, normalised to 0–100)
  const contrast = Math.min(100, Math.round((stdev / MAX_STDEV) * 100));

  // f) Size in KB
  if (sizeKb < MIN_SIZE_KB) {
    failReasons.push(`File size ${sizeKb}KB < minimum ${MIN_SIZE_KB}KB`);
  }

  const passed =
    width >= MIN_WIDTH &&
    height >= MIN_HEIGHT &&
    !isBlurry &&
    sizeKb >= MIN_SIZE_KB;

  return {
    filePath:  fileName,
    width,
    height,
    sizeKb,
    format,
    isBlurry,
    brightness: Math.round(brightness),
    contrast,
    passed,
    failReasons,
  };
}

// ─── filterImages ─────────────────────────────────────────────────────────────

export async function filterImages(
  images: Array<{ buffer: Buffer; name: string }>,
): Promise<{ passed: ImageAnalysis[]; failed: ImageAnalysis[] }> {
  const results = await Promise.all(
    images.map(({ buffer, name }) => analyzeImageQuality(buffer, name)),
  );

  const passed = results
    .filter((r) => r.passed)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const failed = results.filter((r) => !r.passed);

  return { passed, failed };
}

// ─── autoFixImage ─────────────────────────────────────────────────────────────

export async function autoFixImage(imageBuffer: Buffer): Promise<Buffer> {
  const greyStats  = await sharp(imageBuffer).greyscale().stats();
  const mean       = greyStats.channels[0]?.mean ?? 128;

  let pipeline = sharp(imageBuffer);

  // Resize if wider than 2400px (preserve aspect ratio)
  const meta = await pipeline.metadata();
  if ((meta.width ?? 0) > 2400) {
    pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
  }

  // Normalize brightness for very dark or very bright images
  if (mean < 80) {
    // Too dark — brighten
    pipeline = pipeline.modulate({ brightness: 1.3 });
  } else if (mean > 200) {
    // Too bright — darken
    pipeline = pipeline.modulate({ brightness: 0.8 });
  }

  // Convert to WebP at quality 85
  const result = await pipeline.webp({ quality: 85 }).toBuffer();
  return result;
}
