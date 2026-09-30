/**
 * HEIC → JPEG conversion for uploads.
 *
 * sharp's prebuilt libvips reads HEIF only with AV1 (AVIF); HEVC-encoded HEIC —
 * the default photo format on many Samsung / iPhone cameras — fails with
 * "Support for this compression format has not been built in". Such buffers are
 * decoded here via libheif (wasm) before they reach sharp.
 */
import convert from 'heic-convert';

const HEVC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);

/** True when the buffer is an ISO-BMFF file whose ftyp box lists an HEVC image brand. */
export function isHeic(buf: Buffer): boolean {
  if (buf.length < 16 || buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const boxEnd = Math.min(buf.readUInt32BE(0), buf.length, 64);
  // major brand at 8..12, minor version at 12..16, compatible brands after
  if (HEVC_BRANDS.has(buf.toString('ascii', 8, 12))) return true;
  for (let i = 16; i + 4 <= boxEnd; i += 4) {
    if (HEVC_BRANDS.has(buf.toString('ascii', i, i + 4))) return true;
  }
  return false;
}

/** Returns a JPEG buffer for HEIC input, or the original buffer untouched. */
export async function heicToJpegIfNeeded(buf: Buffer): Promise<Buffer> {
  if (!isHeic(buf)) return buf;
  const jpeg = await convert({ buffer: new Uint8Array(buf), format: 'JPEG', quality: 0.92 });
  return Buffer.from(jpeg);
}
