import sharp from 'sharp';

// MIME types browsers may report for RAW files (inconsistent across browsers)
export const RAW_MIME_TYPES = new Set([
  'image/x-canon-cr2',
  'image/x-canon-crw',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
  'image/x-olympus-orf',
  'image/x-fuji-raf',
  'image/x-panasonic-rw2',
  'image/x-samsung-srw',
  'image/x-pentax-pef',
  'image/x-dcraw',
  'application/octet-stream', // checked in combination with extension
]);

export const RAW_EXTENSIONS = new Set([
  '.cr2', '.cr3', '.crw',  // Canon
  '.nef', '.nrw',           // Nikon
  '.arw', '.srf', '.sr2',  // Sony
  '.dng',                    // Adobe DNG (universal)
  '.orf',                    // Olympus
  '.raf',                    // Fuji
  '.rw2',                    // Panasonic
  '.srw',                    // Samsung
  '.pef',                    // Pentax
  '.raw',                    // Generic
]);

export function isRawFile(mimeType: string, fileName: string): boolean {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (RAW_EXTENSIONS.has(ext)) return true;
  // Only trust MIME-only match if it's a known specific RAW type (not octet-stream)
  return RAW_MIME_TYPES.has(mimeType) && mimeType !== 'application/octet-stream';
}

export interface RawConversionResult {
  buffer: Buffer;         // High-quality PNG buffer ready for Sharp pipeline
  width: number;
  height: number;
  originalFormat: string; // 'CR2', 'NEF', 'DNG', etc.
  bitDepth: number;       // 8 or 16
}

export async function convertRawToImage(
  rawBuffer: Buffer,
  fileName: string,
): Promise<RawConversionResult> {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '.raw';
  const originalFormat = ext.replace('.', '').toUpperCase();

  // Attempt 1: Sharp/libvips (handles DNG natively, and some other formats depending on build)
  try {
    const meta = await sharp(rawBuffer).metadata();
    if (meta.width && meta.height) {
      const pngBuffer = await sharp(rawBuffer)
        .rotate()           // honour EXIF orientation
        .png({ quality: 100, compressionLevel: 1 })
        .toBuffer();
      const pngMeta = await sharp(pngBuffer).metadata();
      return {
        buffer: pngBuffer,
        width: pngMeta.width!,
        height: pngMeta.height!,
        originalFormat,
        bitDepth: meta.depth === 'ushort' ? 16 : 8,
      };
    }
  } catch {
    // libvips cannot decode this RAW format — fall through to dcraw
  }

  // Attempt 2: dcraw.js (asm.js port, works on Vercel Serverless without native binaries)
  // Uses camera white balance, 16-bit TIFF output, high-quality AHD interpolation
  const dcraw: (buf: Buffer | Uint8Array, opts: Record<string, unknown>) => Buffer =
    (await import('dcraw')).default ?? (await import('dcraw'));

  const tiffBuffer: Buffer = dcraw(rawBuffer, {
    exportAsTiff: true,
    useCameraWhiteBalance: true,
    use16BitMode: true,
    setInterpolationQuality: 3, // AHD — highest quality
    setHighlightMode: 0,        // clip highlights
  }) as Buffer;

  if (!tiffBuffer || tiffBuffer.length === 0) {
    throw new Error(`dcraw could not decode ${fileName} — unsupported RAW format`);
  }

  // dcraw outputs TIFF — convert to PNG for pipeline compatibility
  const pngBuffer = await sharp(tiffBuffer)
    .png({ quality: 100, compressionLevel: 1 })
    .toBuffer();

  const meta = await sharp(pngBuffer).metadata();

  return {
    buffer: pngBuffer,
    width: meta.width!,
    height: meta.height!,
    originalFormat,
    bitDepth: 16,
  };
}
