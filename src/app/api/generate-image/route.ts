import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { grokGenerate } from '@/lib/xai-client';
import { bflGenerate, aspectToSize } from '@/lib/bfl-client';

interface GenerateBody {
  prompt:          string;
  aspect_ratio?:   string;
  megapixels?:     string;
  target_width?:   number;
  target_height?:  number;
  output_format?:  'webp' | 'png' | 'jpeg';
  website?:        string;
  provider?:       'flux' | 'flux-dev' | 'grok' | 'flux-redux' | 'flux-pro';
  reference_image?: string;
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

  if (!(await checkRateLimitWithBypass(`img:${ip}:${session.user.id}`, RATE_LIMITS.generateImage[planType], session.user.id))) {
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

    const xaiKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'xai' } },
      select: { encryptedKey: true },
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
      const grokUrl  = await grokGenerate(xaiKey, prompt);
      const grokRes  = await fetch(grokUrl);
      const inputBuf = Buffer.from(await grokRes.arrayBuffer());
      const pipeline = sharp(inputBuf);

      if (targetW && targetH) {
        pipeline.resize(targetW, targetH, { fit: 'cover' });
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

  // ── Flux Redux path (style-consistent variation from reference image) ─────────
  if (body.provider === 'flux-redux' && body.reference_image) {
    const reduxKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
      select: { encryptedKey: true },
    });
    const reduxToken = reduxKeyRecord
      ? decrypt(reduxKeyRecord.encryptedKey)
      : (process.env.REPLICATE_API_TOKEN ?? '');
    if (!reduxToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const creditCheck = await checkCredits(session.user.id, 'image');
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }

    try {
      const reduxReplicate = new Replicate({ auth: reduxToken });
      const reduxOutput = await reduxReplicate.run(
        'black-forest-labs/flux-redux-schnell' as `${string}/${string}`,
        {
          input: {
            redux_image:         body.reference_image,
            num_outputs:         1,
            num_inference_steps: 4,
            output_format:       'webp',
            output_quality:      90,
          },
        },
      );

      const reduxUrls = reduxOutput as unknown[];
      const reduxFirst = reduxUrls?.[0];
      let reduxUrl: string | null = null;
      if (typeof reduxFirst === 'string') {
        reduxUrl = reduxFirst;
      } else if (reduxFirst && typeof (reduxFirst as { url?: () => string | URL }).url === 'function') {
        const r = (reduxFirst as { url: () => string | URL }).url();
        reduxUrl = r instanceof URL ? r.toString() : r;
      } else if (reduxFirst instanceof URL) {
        reduxUrl = reduxFirst.toString();
      }

      if (!reduxUrl) {
        return NextResponse.json({ error: 'No image URL in Flux Redux response' }, { status: 500 });
      }

      const reduxFetch = await fetch(reduxUrl);
      const reduxBuf = Buffer.from(await reduxFetch.arrayBuffer());

      if (!creditCheck.byok) await deductCredit(session.user.id, 'image');
      return new Response(reduxBuf, { headers: { 'Content-Type': 'image/webp' } });
    } catch (err) {
      console.error('[flux-redux] Replicate error:', err);
      return NextResponse.json({ error: 'Flux Redux generation failed' }, { status: 500 });
    }
  }

  // ── BFL Flux Pro path (direct Black Forest Labs API) ─────────────────────────
  if (body.provider === 'flux-pro') {
    const bflKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'bfl' } },
      select: { encryptedKey: true },
    });
    const bflApiKey = bflKeyRecord
      ? decrypt(bflKeyRecord.encryptedKey)
      : (process.env.BFL_API_KEY ?? null);

    if (!bflApiKey) {
      return NextResponse.json(
        { error: 'BFL API key not configured. Add it in Settings → API Keys or set BFL_API_KEY env variable.' },
        { status: 400 },
      );
    }

    const creditCheck = await checkCredits(session.user.id, 'image');
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }

    try {
      const { width, height } = aspectToSize(aspect_ratio);
      const bflOutputFormat = requested_format === 'webp' ? 'png' : requested_format;
      const bflUrl = await bflGenerate(bflApiKey, {
        prompt,
        width,
        height,
        outputFormat: bflOutputFormat,
      });

      return await processImageResponse(bflUrl, targetW, targetH, requested_format, 'flux-pro');
    } catch (err) {
      console.error('[flux-pro] BFL error:', err);
      return NextResponse.json({ error: 'BFL generation failed' }, { status: 500 });
    }
  }

  // ── Flux Dev path (Good quality) ─────────────────────────────────────────────
  if (body.provider === 'flux-dev') {
    const devKeyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
      select: { encryptedKey: true },
    });
    const devToken = devKeyRecord
      ? decrypt(devKeyRecord.encryptedKey)
      : (process.env.REPLICATE_API_TOKEN ?? '');
    if (!devToken) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    const devCreditCheck = await checkCredits(session.user.id, 'image');
    if (!devCreditCheck.allowed) {
      return NextResponse.json({ error: devCreditCheck.reason, needsUpgrade: true }, { status: 403 });
    }

    const devReplicate = new Replicate({ auth: devToken });

    try {
      const devOutput = await devReplicate.run('black-forest-labs/flux-dev', {
        input: {
          prompt,
          aspect_ratio,
          num_inference_steps: 50,
          guidance_scale:      3.5,
          output_format:       requested_format === 'jpeg' ? 'png' : requested_format,
          output_quality:      85,
        },
      });

      const devUrls = devOutput as unknown[];
      const devFirst = devUrls?.[0];
      let devImageUrl: string | null = null;
      if (typeof devFirst === 'string') {
        devImageUrl = devFirst;
      } else if (devFirst && typeof (devFirst as { url?: () => string | URL }).url === 'function') {
        const r = (devFirst as { url: () => string | URL }).url();
        devImageUrl = r instanceof URL ? r.toString() : r;
      } else if (devFirst instanceof URL) {
        devImageUrl = devFirst.toString();
      }

      if (!devImageUrl) {
        return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
      }

      const devFluxRes = await fetch(devImageUrl);
      const devInputBuf = Buffer.from(await devFluxRes.arrayBuffer());
      const devPipeline = sharp(devInputBuf);
      if (targetW && targetH) devPipeline.resize(targetW, targetH, { fit: 'fill' });

      let devResized: Buffer;
      let devContentType: string;
      let devExt: string;
      if (requested_format === 'jpeg') {
        devResized = await devPipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        devContentType = 'image/jpeg'; devExt = 'jpg';
      } else if (requested_format === 'png') {
        devResized = await devPipeline.png({ compressionLevel: 8 }).toBuffer();
        devContentType = 'image/png'; devExt = 'png';
      } else {
        devResized = await devPipeline.webp({ quality: 90 }).toBuffer();
        devContentType = 'image/webp'; devExt = 'webp';
      }

      if (!devCreditCheck.byok) {
        await deductCredit(session.user.id, 'image');
      }

      const devName = targetW && targetH
        ? `flux-dev-${targetW}x${targetH}-${Date.now()}.${devExt}`
        : `flux-dev-${Date.now()}.${devExt}`;

      return new Response(new Uint8Array(devResized), {
        headers: {
          'Content-Type':        devContentType,
          'Content-Disposition': `inline; filename="${devName}"`,
          'Cache-Control':       'no-store',
        },
      });
    } catch (err) {
      console.error('[flux-dev] Replicate error:', err);
      if (isQuotaError(err)) {
        const bflFallback = await tryBflFallback(session.user.id, prompt, aspect_ratio, targetW, targetH, requested_format);
        if (bflFallback) return bflFallback;
      }
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
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
    if (isQuotaError(err)) {
      const bflFallback = await tryBflFallback(session.user.id, prompt, aspect_ratio, targetW, targetH, requested_format);
      if (bflFallback) return bflFallback;
    }
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('402') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('rate limit') ||
    msg.includes('payment required')
  );
}

async function processImageResponse(
  imageUrl:   string,
  targetW:    number | undefined,
  targetH:    number | undefined,
  format:     'webp' | 'png' | 'jpeg',
  prefix:     string,
): Promise<Response> {
  const imgRes  = await fetch(imageUrl);
  const buf     = Buffer.from(await imgRes.arrayBuffer());
  const pipe    = sharp(buf);

  if (targetW && targetH) pipe.resize(targetW, targetH, { fit: 'fill' });

  let out:         Buffer;
  let contentType: string;
  let ext:         string;

  if (format === 'jpeg') {
    out = await pipe.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    contentType = 'image/jpeg'; ext = 'jpg';
  } else if (format === 'png') {
    out = await pipe.png({ compressionLevel: 8 }).toBuffer();
    contentType = 'image/png'; ext = 'png';
  } else {
    out = await pipe.webp({ quality: 90 }).toBuffer();
    contentType = 'image/webp'; ext = 'webp';
  }

  const name = targetW && targetH
    ? `${prefix}-${targetW}x${targetH}-${Date.now()}.${ext}`
    : `${prefix}-${Date.now()}.${ext}`;

  return new Response(new Uint8Array(out), {
    headers: {
      'Content-Type':        contentType,
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control':       'no-store',
    },
  });
}

async function tryBflFallback(
  userId:    string,
  prompt:    string,
  ratio:     string,
  targetW:   number | undefined,
  targetH:   number | undefined,
  format:    'webp' | 'png' | 'jpeg',
): Promise<Response | null> {
  try {
    const rec = await db.userApiKey.findUnique({
      where: { userId_provider: { userId, provider: 'bfl' } },
      select: { encryptedKey: true },
    });
    const apiKey = rec ? decrypt(rec.encryptedKey) : (process.env.BFL_API_KEY ?? null);
    if (!apiKey) return null;

    const { width, height } = aspectToSize(ratio);
    const bflFormat = format === 'webp' ? 'png' : format;
    const url = await bflGenerate(apiKey, { prompt, width, height, outputFormat: bflFormat });
    return processImageResponse(url, targetW, targetH, format, 'flux-pro-fallback');
  } catch (fallbackErr) {
    console.error('[generate-image] BFL fallback failed:', fallbackErr);
    return null;
  }
}
