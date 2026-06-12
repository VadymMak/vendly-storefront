import Replicate from 'replicate';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { grokEdit } from '@/lib/xai-client';

export const maxDuration = 60;

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output) && output.length > 0) return String(output[0]);
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

  const file         = formData.get('image') as File | null;
  const prompt       = (formData.get('prompt') as string | null)?.trim() ?? '';
  const provider     = (formData.get('provider') as string | null) ?? 'flux';
  const aspect_ratio = (formData.get('aspect_ratio') as string | null) ?? '1:1';

  const ASPECT_TO_SIZE: Record<string, string> = {
    '1:1':  '1024x1024',
    '9:16': '1024x1792',
    '16:9': '1792x1024',
    '4:5':  '1024x1280',
    '3:2':  '1536x1024',
    '2:3':  '1024x1536',
    '4:3':  '1365x1024',
    '3:4':  '1024x1365',
  };
  const grokSize = ASPECT_TO_SIZE[aspect_ratio] || '1024x1024';

  if (!file)   return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

  // ── Rate limit ────────────────────────────────────────────────────────────────
  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`edit:${ip}:${session.user.id}`, RATE_LIMITS.aiEdit[planType], session.user.id))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Spam check ────────────────────────────────────────────────────────────────
  if (isAbusivePrompt(prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  // ── Grok Imagine path (BYOK — no credit deduction) ────────────────────────────
  if (provider === 'grok') {
    const xaiKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'xai' } },
    });
    if (!xaiKeyRecord) {
      return NextResponse.json({ error: 'xAI API key not configured' }, { status: 400 });
    }
    const xaiKey = decrypt(xaiKeyRecord.encryptedKey);
    if (!xaiKey.startsWith('xai-')) {
      return NextResponse.json(
        { error: 'Invalid xAI API key — please delete it in Settings and re-enter a valid key starting with "xai-"' },
        { status: 400 },
      );
    }

    try {
      const bytes = await file.arrayBuffer();
      const resized = await sharp(Buffer.from(bytes))
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();

      const blob = await put(
        `studio/ai-edit/${session.user.id}/${Date.now()}.png`,
        resized,
        { access: 'public', contentType: 'image/png' },
      );

      const imageUrl = await grokEdit(xaiKey, blob.url, prompt, grokSize);
      return NextResponse.json({ url: imageUrl });
    } catch (err) {
      console.error('[ai-edit grok]', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Grok edit failed' },
        { status: 500 },
      );
    }
  }

  // ── Flux Kontext Pro path (default) ───────────────────────────────────────────
  const creditCheck = await checkCredits(session.user.id, 'image');
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.reason, needsUpgrade: true },
      { status: 403 },
    );
  }

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  });
  if (!keyRecord) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 400 });

  const replicateKey = decrypt(keyRecord.encryptedKey);

  try {
    const bytes = await file.arrayBuffer();

    const resized = await sharp(Buffer.from(bytes))
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const blob = await put(
      `studio/ai-edit/${session.user.id}/${Date.now()}.png`,
      resized,
      { access: 'public', contentType: 'image/png' },
    );

    const replicate = new Replicate({ auth: replicateKey });

    const output = await replicate.run(
      'black-forest-labs/flux-kontext-pro',
      {
        input: {
          prompt,
          input_image:      blob.url,
          aspect_ratio:     'match_input_image',
          safety_tolerance: 2,
          output_format:    'png',
        },
      },
    );

    if (output === null || output === undefined) {
      return NextResponse.json({ error: 'AI edit produced no output' }, { status: 500 });
    }

    const imageUrl = extractUrl(output);

    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'AI edit returned invalid image URL' }, { status: 500 });
    }

    if (!creditCheck.byok) {
      await deductCredit(session.user.id, 'image');
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[ai-edit flux]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI edit failed' },
      { status: 500 },
    );
  }
}
