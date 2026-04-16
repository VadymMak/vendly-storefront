import sharp from 'sharp';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageAnalysis {
  filePath: string;
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  colorSpace: string;
  wasConverted: boolean;
  isBlurry: boolean;
  isDuplicate: boolean;
  brightness: number;  // 0–255 average greyscale mean
  contrast: number;    // 0–100 derived from stdev
  passed: boolean;
  failReasons: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WIDTH         = 1200;
const MIN_HEIGHT        = 630;
const MIN_SIZE_KB       = 50;
const BLUR_THRESHOLD    = 25;    // stdev below this → blurry
const MAX_STDEV         = 128;   // used to normalise contrast 0–100
const HASH_SIZE         = 8;     // 8×8 = 64-bit perceptual hash
const DEFAULT_HAMMING   = 10;    // duplicate threshold

// ─── Perceptual hash ──────────────────────────────────────────────────────────

export async function calculateImageHash(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer)
    .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  const arr   = Array.from(pixels);
  const mean  = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.map((p) => (p >= mean ? '1' : '0')).join('');
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

export function isDuplicate(
  hash: string,
  existingHashes: string[],
  threshold: number = DEFAULT_HAMMING,
): boolean {
  return existingHashes.some((h) => hammingDistance(hash, h) <= threshold);
}

// ─── analyzeImageQuality ──────────────────────────────────────────────────────

export async function analyzeImageQuality(
  rawBuffer: Buffer,
  fileName: string,
  knownHashes: string[] = [],
): Promise<{ analysis: ImageAnalysis; hash: string }> {
  const failReasons: string[] = [];
  let wasConverted = false;

  // Normalise colorspace / bit-depth / alpha
  let meta = await sharp(rawBuffer).metadata();
  let buffer = rawBuffer;

  const colorSpace = meta.space ?? 'srgb';

  if (meta.space === 'cmyk') {
    buffer = await sharp(buffer).toColorspace('srgb').toBuffer();
    wasConverted = true;
    meta = await sharp(buffer).metadata();
  }

  if (meta.depth && meta.depth !== 'uchar' && meta.depth !== 'char') {
    // High bit-depth (16-bit etc.) — normalise to 8-bit sRGB
    buffer = await sharp(buffer).toColorspace('srgb').toBuffer();
    wasConverted = true;
    meta = await sharp(buffer).metadata();
  }

  if (meta.hasAlpha) {
    buffer = await sharp(buffer).flatten({ background: '#ffffff' }).toBuffer();
    wasConverted = true;
    meta = await sharp(buffer).metadata();
  }

  // Dimensions
  const width  = meta.width  ?? 0;
  const height = meta.height ?? 0;
  const format = meta.format ?? 'unknown';
  const sizeKb = Math.round(buffer.byteLength / 1024);

  if (width < MIN_WIDTH)   failReasons.push(`Width ${width}px < minimum ${MIN_WIDTH}px`);
  if (height < MIN_HEIGHT) failReasons.push(`Height ${height}px < minimum ${MIN_HEIGHT}px`);
  if (sizeKb < MIN_SIZE_KB) failReasons.push(`File size ${sizeKb}KB < minimum ${MIN_SIZE_KB}KB`);

  // Blur via greyscale stdev
  const greyStats = await sharp(buffer).greyscale().stats();
  const stdev     = greyStats.channels[0]?.stdev ?? 0;
  const isBlurry  = stdev < BLUR_THRESHOLD;
  if (isBlurry) failReasons.push(`Blurry (stdev ${stdev.toFixed(1)} < ${BLUR_THRESHOLD})`);

  const brightness = Math.round(greyStats.channels[0]?.mean ?? 0);
  const contrast   = Math.min(100, Math.round((stdev / MAX_STDEV) * 100));

  // Perceptual hash + duplicate check
  const hash   = await calculateImageHash(buffer);
  const isDup  = isDuplicate(hash, knownHashes);
  if (isDup) failReasons.push('Duplicate of a previously processed image');

  const passed =
    width >= MIN_WIDTH &&
    height >= MIN_HEIGHT &&
    sizeKb >= MIN_SIZE_KB &&
    !isBlurry &&
    !isDup;

  return {
    analysis: {
      filePath: fileName,
      width,
      height,
      sizeKb,
      format,
      colorSpace,
      wasConverted,
      isBlurry,
      isDuplicate: isDup,
      brightness,
      contrast,
      passed,
      failReasons,
    },
    hash,
  };
}

// ─── filterImages ─────────────────────────────────────────────────────────────

export async function filterImages(
  images: Array<{ buffer: Buffer; name: string }>,
  existingHashes: string[] = [],
): Promise<{ passed: ImageAnalysis[]; failed: ImageAnalysis[]; hashes: Map<string, string> }> {
  const seenHashes = [...existingHashes];
  const hashes = new Map<string, string>();

  const results: ImageAnalysis[] = [];

  // Process sequentially so each image can check hashes of those before it
  for (const { buffer, name } of images) {
    const { analysis, hash } = await analyzeImageQuality(buffer, name, seenHashes);
    hashes.set(name, hash);
    if (!analysis.isDuplicate) seenHashes.push(hash);
    results.push(analysis);
  }

  const passed = results
    .filter((r) => r.passed)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const failed = results.filter((r) => !r.passed);

  return { passed, failed, hashes };
}

// ─── autoFixImage ─────────────────────────────────────────────────────────────

export async function autoFixImage(imageBuffer: Buffer): Promise<Buffer> {
  const greyStats = await sharp(imageBuffer).greyscale().stats();
  const mean      = greyStats.channels[0]?.mean ?? 128;

  let pipeline = sharp(imageBuffer);

  const meta = await pipeline.metadata();
  if ((meta.width ?? 0) > 2400) {
    pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
  }

  if (mean < 80) {
    pipeline = pipeline.modulate({ brightness: 1.3 });
  } else if (mean > 200) {
    pipeline = pipeline.modulate({ brightness: 0.8 });
  }

  return pipeline.webp({ quality: 85 }).toBuffer();
}
