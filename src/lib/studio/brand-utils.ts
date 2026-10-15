import sharp from 'sharp';
import type { BrandKit } from '@prisma/client';
import { db } from '@/lib/db';
import { readLocalUpload } from '@/lib/storage';
import { BRAND_KIT_DEFAULTS, BRAND_KIT_LIMITS, FONT_PRESETS, INSTAGRAM_SAFE_ZONES, SUBTITLE_PRESETS, WATERMARK_POSITIONS } from '@/lib/constants';
import type { BrandColors, BrandKitData, FontPreset, SafeZone, SubtitlePreset, WatermarkPosition } from '@/lib/types';

// Server-only: sharp + db. The client-side Assemble brand store is src/lib/studio/brand-kit.ts.

export interface BrandWatermarkOptions {
  /** Our own /uploads URL — anything else is ignored (never fetched) */
  logoUrl: string;
  position: WatermarkPosition;
  /** 0–1 */
  opacity: number;
  /** Logo width as a fraction of the image width */
  scale: number;
  /** Override the automatic margins (pixels on the actual image) */
  safeZone?: SafeZone;
}

function oneOf<T extends string>(value: string, list: readonly { id: T }[], fallback: T): T {
  return list.some(item => item.id === value) ? value as T : fallback;
}

/** DB row (or none yet) → API shape with every field filled. */
export function toBrandKitData(row: BrandKit | null): BrandKitData {
  if (!row) return { ...BRAND_KIT_DEFAULTS };
  return {
    businessName:      row.businessName ?? '',
    logoUrl:           row.logoUrl,
    instagramHandle:   row.instagramHandle ?? '',
    colorPrimary:      row.colorPrimary ?? BRAND_KIT_DEFAULTS.colorPrimary,
    colorSecondary:    row.colorSecondary ?? BRAND_KIT_DEFAULTS.colorSecondary,
    colorText:         row.colorText ?? BRAND_KIT_DEFAULTS.colorText,
    fontPreset:        oneOf<FontPreset>(row.fontPreset, FONT_PRESETS, BRAND_KIT_DEFAULTS.fontPreset),
    subtitlePreset:    oneOf<SubtitlePreset>(row.subtitlePreset, SUBTITLE_PRESETS, BRAND_KIT_DEFAULTS.subtitlePreset),
    ctaText:           row.ctaText ?? '',
    watermarkEnabled:  row.watermarkEnabled,
    watermarkPosition: oneOf<WatermarkPosition>(row.watermarkPosition, WATERMARK_POSITIONS, BRAND_KIT_DEFAULTS.watermarkPosition),
    watermarkOpacity:  row.watermarkOpacity,
    watermarkScale:    row.watermarkScale,
    enabled:           row.enabled,
  };
}

/** The user's Brand Kit, or null when none exists or it is switched off. */
export async function getUserBrandKit(userId: string): Promise<BrandKitData | null> {
  const row = await db.brandKit.findUnique({ where: { userId } });
  if (!row || !row.enabled) return null;
  return toBrandKitData(row);
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Suggest brand colors from a logo. sharp's stats().dominant counts transparent pixels
 * (usually black) and plain backgrounds, so this builds its own histogram over opaque
 * pixels and prefers the most common *colored* bin over near-white/near-black ones.
 */
export async function extractBrandColors(image: Buffer): Promise<BrandColors | null> {
  const { data, info } = await sharp(image)
    .resize(64, 64, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    opaque++;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  if (opaque === 0) return null;

  const ranked = [...bins.values()]
    .map(bin => ({ count: bin.count, r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count }))
    .sort((a, b) => b.count - a.count);
  const isNeutral = (c: { r: number; g: number; b: number }) => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max - min < 24 && (max > 225 || max < 40);
  };
  // A colored bin wins if it covers at least 5% of the logo; otherwise the logo really is monochrome
  const pick = ranked.find(c => !isNeutral(c) && c.count >= opaque * 0.05) ?? ranked[0];

  const lighten = (v: number) => v + (255 - v) * 0.85;
  const luminance = (0.299 * pick.r + 0.587 * pick.g + 0.114 * pick.b) / 255;
  return {
    primary:   toHex(pick.r, pick.g, pick.b),
    secondary: toHex(lighten(pick.r), lighten(pick.g), lighten(pick.b)),
    text:      luminance > 0.5 ? '#1A1A1A' : '#FFFFFF',
  };
}

/**
 * Margins for the watermark. Story-shaped frames (≥ ~9:16) keep clear of Instagram's
 * overlay, scaled from the 1080×1920 reference; other shapes (feed, square) have no
 * overlay inside the image, so a small edge padding is enough.
 */
function marginsFor(width: number, height: number): SafeZone {
  if (height / width >= 1.7) {
    const sx = width / 1080;
    const sy = height / 1920;
    return {
      top:    Math.round(INSTAGRAM_SAFE_ZONES.top * sy),
      bottom: Math.round(INSTAGRAM_SAFE_ZONES.bottom * sy),
      sides:  Math.round(INSTAGRAM_SAFE_ZONES.sides * sx),
    };
  }
  const pad = Math.round(width * 0.04);
  return { top: pad, bottom: pad, sides: pad };
}

/**
 * Composite the brand logo onto an image. Returns the input unchanged when the logo
 * can't be read. Used by Improve Photo, Creative Edit, Reel Builder, Text Overlay.
 */
export async function applyBrandWatermark(imageBuffer: Buffer, options: BrandWatermarkOptions): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  if (!meta.width || !meta.height) return imageBuffer;

  let logo: Awaited<ReturnType<typeof readLocalUpload>>;
  try {
    logo = await readLocalUpload(options.logoUrl, BRAND_KIT_LIMITS.logoMaxBytes);
  } catch (err) {
    console.error('[brand-utils] logo unreadable:', err instanceof Error ? err.message : err);
    return imageBuffer;
  }
  if (!logo) return imageBuffer;

  const scale = Math.min(Math.max(options.scale, BRAND_KIT_LIMITS.watermarkScaleMin), BRAND_KIT_LIMITS.watermarkScaleMax);
  const targetWidth = Math.max(1, Math.round(meta.width * scale));

  // Apply opacity by scaling the alpha channel directly
  const { data, info } = await sharp(logo.buffer)
    .resize(targetWidth, targetWidth, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const opacity = Math.min(Math.max(options.opacity, 0), 1);
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  const overlay = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();

  const zone = options.safeZone ?? marginsFor(meta.width, meta.height);
  const right  = meta.width - info.width - zone.sides;
  const bottom = meta.height - info.height - zone.bottom;
  const left = options.position.endsWith('right') ? right : zone.sides;
  const top  = options.position.startsWith('bottom') ? bottom : zone.top;

  return sharp(imageBuffer)
    .composite([{
      input: overlay,
      left: Math.min(Math.max(0, left), Math.max(0, meta.width - info.width)),
      top:  Math.min(Math.max(0, top), Math.max(0, meta.height - info.height)),
    }])
    .toBuffer();
}
