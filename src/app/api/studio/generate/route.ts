import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { getModel, LEGACY_GENERATE_ALIAS } from '@/lib/studio/config';
import { getProvider } from '@/lib/studio/providers';
import { resolveApiKey } from '@/lib/studio/resolve';
import { logUsage } from '@/lib/studio/usage-logger';

export const maxDuration = 120;

interface GenerateBody {
  prompt:        string;
  modelAlias?:   string;
  // legacy compat
  provider?:     string;
  aspect_ratio?: string;
  megapixels?:   string;
  target_width?: number;
  target_height?: number;
  output_format?: 'webp' | 'png' | 'jpeg';
  reference_image?: string;
  website?:      string;
}

async function processBuffer(
  imageUrl:   string,
  targetW:    number | undefined,
  targetH:    number | undefined,
  format:     'webp' | 'png' | 'jpeg',
  prefix:     string,
): Promise<Response> {
  const arrBuf: ArrayBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
  const buf  = Buffer.from(arrBuf);
  const pipe = sharp(buf);
  if (targetW && targetH) pipe.resize(targetW, targetH, { fit: 'fill' });

  let out: Buffer;
  let ct: string;
  let ext: string;

  if (format === 'jpeg') {
    out = await pipe.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    ct = 'image/jpeg'; ext = 'jpg';
  } else if (format === 'png') {
    out = await pipe.png({ compressionLevel: 8 }).toBuffer();
    ct = 'image/png'; ext = 'png';
  } else {
    out = await pipe.webp({ quality: 90 }).toBuffer();
    ct = 'image/webp'; ext = 'webp';
  }

  const name = targetW && targetH
    ? `${prefix}-${targetW}x${targetH}-${Date.now()}.${ext}`
    : `${prefix}-${Date.now()}.${ext}`;

  return new Response(new Uint8Array(out), {
    headers: {
      'Content-Type':        ct,
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control':       'no-store',
    },
  });
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot
  if (body.website) return NextResponse.json({ success: true });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  // Rate limit
  const ip       = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`img:${ip}:${session.user.id}`, RATE_LIMITS.generateImage[planType], session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  if (isAbusivePrompt(prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  // Resolve model alias — prefer explicit modelAlias, fall back to legacy provider string
  const rawAlias = body.modelAlias ?? (body.provider ? (LEGACY_GENERATE_ALIAS[body.provider] ?? 'img-fast') : 'img-fast');
  const model    = getModel(rawAlias);
  if (!model || model.operation !== 'generate') {
    return NextResponse.json({ error: `Unknown model: ${rawAlias}` }, { status: 400 });
  }

  // Resolve API key
  const apiKey = await resolveApiKey(session.user.id, model);
  if (!apiKey) {
    return NextResponse.json(
      { error: `${model.displayName} API key not configured. Add it in Settings → API Keys.` },
      { status: 400 },
    );
  }

  // Credit check (skip for BYOK-only models)
  let creditCheck: { allowed: boolean; byok?: boolean; reason?: string } = { allowed: true, byok: true };
  if (!model.byokOnly) {
    creditCheck = await checkCredits(session.user.id, model.creditType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }
  }

  const aspect_ratio     = body.aspect_ratio  ?? '1:1';
  const megapixels       = body.megapixels     ?? '1';
  const targetW          = body.target_width;
  const targetH          = body.target_height;
  const outputFormat     = (['webp', 'png', 'jpeg'].includes(body.output_format ?? ''))
    ? (body.output_format as 'webp' | 'png' | 'jpeg')
    : 'webp';

  const provider  = getProvider(model.provider);
  const startTime = Date.now();

  try {
    const result = await provider.generate(
      {
        prompt,
        aspectRatio:    aspect_ratio,
        megapixels,
        outputFormat,
        referenceImage: body.reference_image,
      },
      apiKey,
      model.modelId,
    );
    const durationMs = Date.now() - startTime;

    if (!model.byokOnly && !creditCheck.byok) {
      await deductCredit(session.user.id, model.creditType);
    }

    await logUsage({
      userId:     session.user.id,
      modelAlias: rawAlias,
      provider:   model.provider,
      modelId:    model.modelId,
      operation:  'generate',
      status:     'success',
      durationMs,
      costUsd:    model.costPerCall,
      creditCost: model.byokOnly ? 0 : model.creditCost,
      byok:       model.byokOnly ?? (creditCheck.byok ?? false),
      metadata:   { aspect_ratio, outputFormat, promptLength: prompt.length },
    });

    return processBuffer(result.url, targetW, targetH, outputFormat, rawAlias);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : 'Generation failed';
    await logUsage({
      userId:       session.user.id,
      modelAlias:   rawAlias,
      provider:     model.provider,
      modelId:      model.modelId,
      operation:    'generate',
      status:       'error',
      durationMs,
      costUsd:      0,
      creditCost:   0,
      byok:         model.byokOnly ?? false,
      errorMessage: msg,
    });
    console.error(`[studio/generate][${rawAlias}]`, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
