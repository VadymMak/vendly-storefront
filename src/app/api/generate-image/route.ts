import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { grokGenerate, aspectToGrokSize } from '@/lib/xai-client';

interface GenerateBody {
  prompt:         string;
  aspect_ratio?:  string;
  megapixels?:    string;
  target_width?:  number;
  target_height?: number;
  output_format?: 'webp' | 'png' | 'jpeg';
  website?:       string;
  provider?:      'flux' | 'grok';
}

export async function POST(request: Request) {
  // ── Parse body (needed for honeypot — must come before auth) ──────────────────
  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Honeypot — silent reject (bot thinks it worked) ───────────────────────────
  if (body.website) {
    return NextResponse.json({ success: true });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────────
  const ip       = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!checkRateLimit(`img:${ip}:${session.user.id}`, RATE_LIMITS.generateImage[planType])) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Spam check ────────────────────────────────────────────────────────────────
  if (isAbusivePrompt(prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  const aspect_ratio     = body.aspect_ratio ?? '1:1';
  const megapixels       = body.megapixels   ?? '1';
  const targetW          = body.target_width;
  const targetH          = body.target_height;
  const requested_format = ['webp', 'png', 'jpeg'].includes(body.output_format ?? '')
    ? (body.output_format as 'webp' | 'png' | 'jpeg')
    : 'webp';

  console.log('API received:', { aspect_ratio, megapixels, targetW, targetH, requested_format, provider: body.provider });

  // ── Grok Imagine path (BYOK — no credit deduction) ────────────────────────────
  if (body.provider === 'grok') {
    const xaiKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'xai' } },
      select: { encryptedKey: true },
    });
    if (!xaiKeyRecord) {
      return NextResponse.json({ error: 'xAI API key not configured' }, { status: 400 });
    }
    const xaiKey = decrypt(xaiKeyRecord.encryptedKey);
    const grokSize = aspectToGrokSize(aspect_ratio);

    try {
      const grokUrl  = await grokGenerate(xaiKey, prompt, grokSize);
      const grokRes  = await fetch(grokUrl);
      const inputBuf = Buffer.from(await grokRes.arrayBuffer());
      const pipeline = sharp(inputBuf);

      if (targetW && targetH) {
        pipeline.resize(targetW, targetH, { fit: 'fill' });
      }

      let resized: Buffer;
      let contentType: string;
      let ext: string;

      if (requested_format === 'jpeg') {
        resized     = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        contentType = 'image/jpeg';
        ext         = 'jpg';
      } else if (requested_format === 'png') {
        resized     = await pipeline.png({ compressionLevel: 8 }).toBuffer();
        contentType = 'image/png';
        ext         = 'png';
      } else {
        resized     = await pipeline.webp({ quality: 90 }).toBuffer();
        contentType = 'image/webp';
        ext         = 'webp';
      }

      const name = targetW && targetH
        ? `grok-${targetW}x${targetH}-${Date.now()}.${ext}`
        : `grok-${Date.now()}.${ext}`;

      return new Response(new Uint8Array(resized), {
        headers: {
          'Content-Type':        contentType,
          'Content-Disposition': `inline; filename="${name}"`,
          'Cache-Control':       'no-store',
        },
      });
    } catch (err) {
      console.error('Grok error:', err);
      return NextResponse.json({ error: 'Grok generation failed' }, { status: 500 });
    }
  }

  // ── Flux Schnell path (default) ───────────────────────────────────────────────
  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
    select: { encryptedKey: true },
  });
  const token = keyRecord
    ? decrypt(keyRecord.encryptedKey)
    : (process.env.REPLICATE_API_TOKEN ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
  }

  // ── Credit check ─────────────────────────────────────────────────────────────
  const creditCheck = await checkCredits(session.user.id, 'image');
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: creditCheck.reason, needsUpgrade: true },
      { status: 403 },
    );
  }

  // Flux Schnell doesn't support jpeg output — generate png, convert via Sharp
  const replicate_format = requested_format === 'jpeg' ? 'png' : requested_format;

  const replicate = new Replicate({ auth: token });

  try {
    const output = await replicate.run(
      'black-forest-labs/flux-schnell',
      {
        input: {
          prompt,
          aspect_ratio,
          megapixels,
          num_outputs:         1,
          num_inference_steps: 4,
          output_format:       replicate_format,
          output_quality:      90,
          go_fast:             true,
        },
      },
    );

    // SDK returns an array of URLs (or ReadableStream objects for file outputs)
    const urls  = output as unknown[];
    const first = urls?.[0];

    // Handle both plain URL strings and Replicate FileOutput objects
    let imageUrl: string | null = null;
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
      const result = (first as { url: () => string | URL }).url();
      imageUrl = result instanceof URL ? result.toString() : result;
    } else if (first instanceof URL) {
      imageUrl = first.toString();
    }

    if (!imageUrl) {
      console.error('Unexpected Replicate output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
    }

    // ── Fetch Flux output + Sharp resize to exact target dimensions ───────────
    const fluxRes    = await fetch(imageUrl);
    const inputBuf   = Buffer.from(await fluxRes.arrayBuffer());
    const pipeline   = sharp(inputBuf);

    if (targetW && targetH) {
      pipeline.resize(targetW, targetH, { fit: 'fill' });
    }

    let resized: Buffer;
    let contentType: string;
    let ext: string;

    if (requested_format === 'jpeg') {
      resized     = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      contentType = 'image/jpeg';
      ext         = 'jpg';
    } else if (requested_format === 'png') {
      resized     = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      contentType = 'image/png';
      ext         = 'png';
    } else {
      resized     = await pipeline.webp({ quality: 90 }).toBuffer();
      contentType = 'image/webp';
      ext         = 'webp';
    }

    const name = targetW && targetH
      ? `flux-${targetW}x${targetH}-${Date.now()}.${ext}`
      : `flux-${Date.now()}.${ext}`;

    if (!creditCheck.byok) {
      await deductCredit(session.user.id, 'image');
    }

    return new Response(new Uint8Array(resized), {
      headers: {
        'Content-Type':        contentType,
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('Replicate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
