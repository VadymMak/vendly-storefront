import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit } from '@/lib/credits';
import { verifyTurnstile } from '@/lib/turnstile';

export const maxDuration = 60;

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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData       = await req.formData();
  const turnstileToken = formData.get('turnstileToken') as string | null;
  const ip             = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  if (!await verifyTurnstile(turnstileToken ?? '', ip)) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

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
    const file     = formData.get('image') as File | null;
    const rawType  = formData.get('type') as string | null;
    const type: EnhanceType = (rawType && rawType in ENHANCE_TYPES)
      ? (rawType as EnhanceType)
      : 'upscale';

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

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
