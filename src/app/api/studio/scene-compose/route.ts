import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { grokMultiImageEdit } from '@/lib/xai-client';

export const maxDuration = 120;

interface SceneComposeBody {
  imageUrls: string[];
  prompt: string;
  aspectRatio?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SceneComposeBody;
  try {
    body = await req.json() as SceneComposeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imageUrls, prompt, aspectRatio } = body;

  if (!imageUrls?.length) {
    return NextResponse.json({ error: 'At least one image URL is required' }, { status: 400 });
  }
  if (imageUrls.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 images per request' }, { status: 400 });
  }
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Scene description is required' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(
    `scene:${ip}:${session.user.id}`,
    RATE_LIMITS.aiEdit[planType],
    session.user.id
  ))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  if (isAbusivePrompt(prompt.trim())) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  const xaiKeyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'xai' } },
    select: { encryptedKey: true },
  });
  if (!xaiKeyRecord) {
    return NextResponse.json(
      { error: 'xAI API key not configured. Add it in Settings → API Keys.' },
      { status: 400 },
    );
  }
  const xaiKey = decrypt(xaiKeyRecord.encryptedKey);
  if (!xaiKey.startsWith('xai-')) {
    return NextResponse.json(
      { error: 'Invalid xAI API key — please re-enter a valid key starting with "xai-"' },
      { status: 400 },
    );
  }

  try {
    console.log('[scene-compose] Calling Grok multi-image edit with', imageUrls.length, 'images');

    const resultUrl = await grokMultiImageEdit(xaiKey, imageUrls, prompt.trim(), aspectRatio);

    const imgRes = await fetch(resultUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    const blob = await put(
      `studio/scene-compose/${session.user.id}/${Date.now()}-result.${ext}`,
      imgBuffer,
      { access: 'public', contentType },
    );

    console.log('[scene-compose] Done:', blob.url);
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[scene-compose] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scene composition failed' },
      { status: 500 },
    );
  }
}
