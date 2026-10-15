import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { del, put } from '@/lib/storage';
import { BRAND_KIT_DEFAULTS, BRAND_KIT_LIMITS } from '@/lib/constants';
import { extractBrandColors } from '@/lib/studio/brand-utils';
import type { BrandColors } from '@/lib/types';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// POST — upload a logo, store it as PNG, suggest brand colors from it
export async function POST(req: Request) {
  // Reject oversized bodies before buffering them (multipart overhead allowance on top)
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > BRAND_KIT_LIMITS.logoMaxBytes + 64 * 1024) {
    return NextResponse.json({ error: 'Logo must be under 5MB' }, { status: 413 });
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('logo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No logo file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use PNG, JPEG, WebP or SVG' }, { status: 400 });
  }
  if (file.size > BRAND_KIT_LIMITS.logoMaxBytes) {
    return NextResponse.json({ error: 'Logo must be under 5MB' }, { status: 413 });
  }

  // Everything is rasterised to PNG: keeps transparency, gives the watermark step one format,
  // and never serves an uploaded SVG (script-capable) back from our origin
  let png: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const max = BRAND_KIT_LIMITS.logoMaxSide;
    png = await sharp(input, { density: file.type === 'image/svg+xml' ? 300 : undefined })
      .rotate()
      .resize(max, max, { fit: 'inside', withoutEnlargement: file.type !== 'image/svg+xml' })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'Could not read this image' }, { status: 400 });
  }

  let suggestedColors: BrandColors = {
    primary:   BRAND_KIT_DEFAULTS.colorPrimary,
    secondary: BRAND_KIT_DEFAULTS.colorSecondary,
    text:      BRAND_KIT_DEFAULTS.colorText,
  };
  try {
    suggestedColors = (await extractBrandColors(png)) ?? suggestedColors;
  } catch (err) {
    // Extraction is a suggestion only — keep the logo with default colors
    console.error('[brand-kit/logo] color extraction failed:', err instanceof Error ? err.message : err);
  }

  const { url: logoUrl } = await put(`brand/${userId}/logo-${Date.now()}.png`, png, {
    access: 'public',
    contentType: 'image/png',
  });

  const existing = await db.brandKit.findUnique({
    where:  { userId },
    select: { logoUrl: true, colorPrimary: true, colorSecondary: true, colorText: true },
  });

  // Colors the user already chose are kept; only empty ones take the suggestion
  await db.brandKit.upsert({
    where:  { userId },
    create: {
      user:           { connect: { id: userId } },
      logoUrl,
      colorPrimary:   suggestedColors.primary,
      colorSecondary: suggestedColors.secondary,
      colorText:      suggestedColors.text,
    },
    update: {
      logoUrl,
      ...(existing?.colorPrimary ? {} : { colorPrimary: suggestedColors.primary }),
      ...(existing?.colorSecondary ? {} : { colorSecondary: suggestedColors.secondary }),
      ...(existing?.colorText ? {} : { colorText: suggestedColors.text }),
    },
  });

  if (existing?.logoUrl && existing.logoUrl !== logoUrl) void del(existing.logoUrl).catch(() => {});

  return NextResponse.json({ success: true, logoUrl, suggestedColors });
}
