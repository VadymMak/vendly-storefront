import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';

export const maxDuration = 300;

const ENHANCE_TYPES = {
  upscale:  { scale: 4, face_enhance: false },
  portrait: { scale: 2, face_enhance: true  },
} as const;

type EnhanceType = keyof typeof ENHANCE_TYPES;

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (output && typeof (output as Record<string, unknown>)['url'] === 'function') {
    const result = (output as { url: () => string | URL }).url();
    return result instanceof URL ? result.toString() : String(result);
  }
  return String(output);
}

export async function POST(req: Request) {
  // ── Parse body (needed for honeypot — must come before auth) ──────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // ── Honeypot — silent reject (bot thinks it worked) ───────────────────────────
  if (formData.get('website')) {
    return NextResponse.json({ success: true });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const file    = formData.get('image') as File | null;
  const rawType = formData.get('type') as string | null;
  const type: EnhanceType = (rawType && rawType in ENHANCE_TYPES)
    ? (rawType as EnhanceType)
    : 'upscale';

  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  // ── Rate limit ────────────────────────────────────────────────────────────────
  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`enh:${ip}:${session.user.id}`, RATE_LIMITS.enhanceImage[planType], session.user.id))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Credit check ─────────────────────────────────────────────────────────────
  const creditCheck = await checkCredits(session.user.id, 'image');
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.reason, needsUpgrade: true },
      { status: 403 },
    );
  }

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const replicateKey = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!replicateKey) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });

  const rawScale = Number(formData.get('scale')) || 2;

  // ── SUPIR Premium path ────────────────────────────────────────────────────
  if (rawType === 'supir') {
    const qualityPrompt = (formData.get('quality_prompt') as string) || '';

    try {
      const bytes    = await file.arrayBuffer();
      const base64   = Buffer.from(bytes).toString('base64');
      const mimeType = file.type || 'image/jpeg';
      const dataUrl  = `data:${mimeType};base64,${base64}`;

      const replicate = new Replicate({ auth: replicateKey });

      const output = await replicate.run(
        'cjwbw/supir-v0q',
        {
          input: {
            image:          dataUrl,
            upscale:        Math.min(rawScale, 4),
            edm_steps:      50,
            s_stage1:       -1,
            s_stage2:       1,
            s_cfg:          7.5,
            a_prompt:       qualityPrompt || 'high quality, detailed, sharp focus, professional photo',
            n_prompt:       'blurry, noise, artifacts, distortion, low quality, pixelated',
            color_fix_type: 'Wavelet',
            min_size:       1024,
          },
        },
      );

      const supirUrl = extractUrl(output);
      const supirRes = await fetch(supirUrl);
      const supirBuf = Buffer.from(await supirRes.arrayBuffer());
      const blob     = await put(
        `studio/supir/${session.user.id}/${Date.now()}.png`,
        supirBuf,
        { access: 'public', contentType: 'image/png' },
      );

      if (!creditCheck.byok) {
        await deductCredit(session.user.id, 'image');
      }

      return NextResponse.json({ url: blob.url });
    } catch (err) {
      console.error('[enhance-image supir]', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'SUPIR enhancement failed' },
        { status: 500 },
      );
    }
  }

  try {
    const bytes    = await file.arrayBuffer();
    const base64   = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl  = `data:${mimeType};base64,${base64}`;

    const replicate = new Replicate({ auth: replicateKey });
    const params    = ENHANCE_TYPES[type];

    const output = await replicate.run(
      'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
      {
        input: {
          image:        dataUrl,
          scale:        params.scale,
          face_enhance: params.face_enhance,
        },
      },
    );

    const imageUrl = extractUrl(output);

    if (!creditCheck.byok) {
      await deductCredit(session.user.id, 'image');
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[enhance-image]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Enhancement failed' },
      { status: 500 },
    );
  }
}
