import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { del } from '@/lib/storage';
import { BRAND_KIT_LIMITS, FONT_PRESETS, SUBTITLE_PRESETS, WATERMARK_POSITIONS } from '@/lib/constants';
import { toBrandKitData } from '@/lib/studio/brand-utils';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

// GET — the user's Brand Kit, or defaults when it hasn't been set up yet
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await db.brandKit.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ exists: row !== null, data: toBrandKitData(row) });
}

type Body = Record<string, unknown>;

/** Optional text field: absent → skip, '' / null → clear, otherwise trimmed and length-checked. */
function textField(body: Body, key: string, max: number): string | null | undefined | Error {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null) return null;
  if (typeof value !== 'string') return new Error(`${key} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) return new Error(`${key} must be at most ${max} characters`);
  return trimmed || null;
}

// PUT — create or update; only known fields, each validated
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  let body: Body;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Prisma.BrandKitUpdateInput = {};
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });

  const businessName = textField(body, 'businessName', BRAND_KIT_LIMITS.businessNameMax);
  if (businessName instanceof Error) return fail(businessName.message);
  if (businessName !== undefined) data.businessName = businessName;

  const ctaText = textField(body, 'ctaText', BRAND_KIT_LIMITS.ctaTextMax);
  if (ctaText instanceof Error) return fail(ctaText.message);
  if (ctaText !== undefined) data.ctaText = ctaText;

  const handle = textField(body, 'instagramHandle', 31);
  if (handle instanceof Error) return fail(handle.message);
  if (handle !== undefined) {
    const clean = handle?.replace(/^@/, '') || null;
    if (clean && !INSTAGRAM_HANDLE.test(clean)) return fail('Invalid instagramHandle');
    data.instagramHandle = clean;
  }

  for (const key of ['colorPrimary', 'colorSecondary', 'colorText'] as const) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value !== null && (typeof value !== 'string' || !HEX_COLOR.test(value))) return fail(`Invalid ${key} format`);
    data[key] = value;
  }

  const enums = [
    ['fontPreset', FONT_PRESETS],
    ['subtitlePreset', SUBTITLE_PRESETS],
    ['watermarkPosition', WATERMARK_POSITIONS],
  ] as const;
  for (const [key, list] of enums) {
    if (!(key in body)) continue;
    const value = body[key];
    if (typeof value !== 'string' || !list.some(item => item.id === value)) return fail(`Invalid ${key}`);
    data[key] = value;
  }

  for (const key of ['watermarkEnabled', 'enabled'] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'boolean') return fail(`${key} must be a boolean`);
    data[key] = body[key];
  }

  if ('watermarkOpacity' in body) {
    const opacity = body.watermarkOpacity;
    if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      return fail('watermarkOpacity must be 0-1');
    }
    data.watermarkOpacity = opacity;
  }
  if ('watermarkScale' in body) {
    const scale = body.watermarkScale;
    const { watermarkScaleMin: min, watermarkScaleMax: max } = BRAND_KIT_LIMITS;
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < min || scale > max) {
      return fail(`watermarkScale must be ${min}-${max}`);
    }
    data.watermarkScale = scale;
  }

  // The logo is set only by POST /logo (uploaded + validated there). Here it can only be removed —
  // accepting an arbitrary URL would let the watermark step read whatever it points to.
  let removeLogo = false;
  if ('logoUrl' in body) {
    if (body.logoUrl !== null) return fail('logoUrl can only be set by uploading a logo');
    data.logoUrl = null;
    removeLogo = true;
  }

  const previous = removeLogo
    ? await db.brandKit.findUnique({ where: { userId }, select: { logoUrl: true } })
    : null;

  const row = await db.brandKit.upsert({
    where:  { userId },
    create: { ...(data as Prisma.BrandKitCreateWithoutUserInput), user: { connect: { id: userId } } },
    update: data,
  });

  if (previous?.logoUrl) void del(previous.logoUrl).catch(() => {});

  return NextResponse.json({ success: true, data: toBrandKitData(row) });
}
