import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit } from '@/lib/credits';

export const maxDuration = 60;

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
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const bytes   = await file.arrayBuffer();
    const base64  = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const replicate = new Replicate({ auth: replicateKey });

    const output = await replicate.run(
      'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1',
      { input: { image: dataUrl } },
    );

    const imageUrl = extractUrl(output);

    if (!creditCheck.byok) {
      await deductCredit(session.user.id, 'image');
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[remove-bg]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Remove background failed' },
      { status: 500 },
    );
  }
}
