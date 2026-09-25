import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { createJob } from '@/lib/studio-jobs';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';

export const maxDuration = 300;

const ENHANCE_TYPES = {
  upscale:  { scale: 4, face_enhance: false },
  portrait: { scale: 2, face_enhance: true  },
} as const;

type EnhanceType = keyof typeof ENHANCE_TYPES;

function extractUrl(output: unknown): string | null {
  if (typeof output === 'string' && output.startsWith('http')) return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string' && first.startsWith('http')) return first;
    if (first instanceof URL) return first.toString();
  }
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    if (typeof obj.url === 'function') {
      const result = (obj as { url: () => string | URL }).url();
      return result instanceof URL ? result.toString() : typeof result === 'string' && result.startsWith('http') ? result : null;
    }
    if (typeof obj.url === 'string' && obj.url.startsWith('http')) return obj.url;
  }
  return null;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

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
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });

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
        'topazlabs/image-upscale' as `${string}/${string}`,
        {
          input: {
            image: dataUrl,
            scale: Math.min(rawScale, 6),
            model: 'High Fidelity V2',
          },
        },
      );

      const supirUrl = extractUrl(output);
      if (!supirUrl) {
        throw new Error('Upscale model returned invalid result');
      }
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

      const capturedSupirUrl = blob.url;
      createJob({
        userId:       session.user.id,
        predictionId: `supir:${Date.now()}`,
        type:         'upscale',
        creditType:   'image',
        creditAmount: 1,
        metadata:     { modelUsed: 'topazlabs/image-upscale', provider: 'replicate' },
      }).then(async (jobId) => {
        await db.studioJob.update({
          where: { id: jobId },
          data:  { status: 'succeeded', outputUrl: capturedSupirUrl },
        });
      }).catch((err) => { console.error('[enhance-image supir] StudioJob save failed:', err); });

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
    if (!imageUrl) {
      console.error('[enhance-image] Invalid output from Replicate:', typeof output, output);
      return NextResponse.json(
        { error: 'Upscale model returned invalid result. Please try again.' },
        { status: 500 },
      );
    }

    // Persist to Vercel Blob (Replicate URLs expire)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download upscaled image: ${imgRes.status}`);
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const blob   = await put(
      `studio/upscale/${session.user.id}/${Date.now()}.png`,
      imgBuf,
      { access: 'public', contentType: 'image/png' },
    );

    if (!creditCheck.byok) {
      await deductCredit(session.user.id, 'image');
    }

    const capturedUrl = blob.url;
    createJob({
      userId:       session.user.id,
      predictionId: `upscale:${Date.now()}`,
      type:         'upscale',
      creditType:   'image',
      creditAmount: 1,
      metadata:     { modelUsed: 'nightmareai/real-esrgan', provider: 'replicate' },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => { console.error('[enhance-image] StudioJob save failed:', err); });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[enhance-image]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Enhancement failed' },
      { status: 500 },
    );
  }
}
