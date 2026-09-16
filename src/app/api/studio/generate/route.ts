import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { getModel, LEGACY_GENERATE_ALIAS, TIER_ROUTES, MODEL_CATALOG, type ModelEntry } from '@/lib/studio/config';
import { getProvider } from '@/lib/studio/providers';
import { resolveApiKey } from '@/lib/studio/resolve';
import { logUsage } from '@/lib/studio/usage-logger';

export const maxDuration = 120;

interface GenerateBody {
  prompt:           string;
  modelAlias?:      string;
  tier?:            'fast' | 'quality' | 'premium';
  // legacy compat
  provider?:        string;
  aspect_ratio?:    string;
  megapixels?:      string;
  target_width?:    number;
  target_height?:   number;
  output_format?:   'webp' | 'png' | 'jpeg';
  reference_image?: string;
  website?:         string;
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

  // ── Resolve model alias ────────────────────────────────────────────────────

  const requestedRatio = body.aspect_ratio ?? '1:1';
  const megapixels     = body.megapixels   ?? '1';
  const targetW        = body.target_width;
  const targetH        = body.target_height;
  const outputFormat   = (['webp', 'png', 'jpeg'].includes(body.output_format ?? ''))
    ? (body.output_format as 'webp' | 'png' | 'jpeg')
    : 'webp';

  // Build ordered list of models to try
  type Candidate = { alias: string; model: ModelEntry; apiKey: string };
  const candidates: Candidate[] = [];

  if (body.modelAlias) {
    const m = getModel(body.modelAlias);
    if (!m || m.operation !== 'generate') {
      return NextResponse.json({ error: `Unknown model: ${body.modelAlias}` }, { status: 400 });
    }
    const key = await resolveApiKey(session.user.id, m);
    if (!key) {
      return NextResponse.json(
        { error: `${m.displayName} API key not configured. Add it in Settings → API Keys.` },
        { status: 400 },
      );
    }
    candidates.push({ alias: body.modelAlias, model: m, apiKey: key });
  } else if (body.tier && TIER_ROUTES[body.tier]) {
    for (const route of TIER_ROUTES[body.tier]) {
      const m = MODEL_CATALOG[route.alias];
      if (!m || !m.enabled || m.operation !== 'generate') continue;
      const key = await resolveApiKey(session.user.id, m);
      if (key) candidates.push({ alias: route.alias, model: m, apiKey: key });
    }
  } else if (body.provider) {
    const alias = LEGACY_GENERATE_ALIAS[body.provider] ?? 'img-fast';
    const m = getModel(alias);
    if (m && m.operation === 'generate') {
      const key = await resolveApiKey(session.user.id, m);
      if (key) candidates.push({ alias, model: m, apiKey: key });
    }
  } else {
    const m = getModel('img-fast');
    if (m) {
      const key = await resolveApiKey(session.user.id, m);
      if (key) candidates.push({ alias: 'img-fast', model: m, apiKey: key });
    }
  }

  if (candidates.length === 0) {
    const tierAlias = body.tier ? TIER_ROUTES[body.tier]?.[0]?.alias : 'img-fast';
    const fallbackModel = getModel(tierAlias ?? 'img-fast');
    return NextResponse.json(
      { error: `${fallbackModel?.displayName ?? 'Selected model'} API key not configured. Add it in Settings → API Keys.` },
      { status: 400 },
    );
  }

  // ── Try each candidate until one succeeds ──────────────────────────────────

  let lastError = 'Generation failed';

  for (const { alias, model, apiKey } of candidates) {
    let creditCheck: { allowed: boolean; byok?: boolean; reason?: string } = { allowed: true, byok: true };
    if (!model.byokOnly) {
      creditCheck = await checkCredits(session.user.id, model.creditType);
      if (!creditCheck.allowed) {
        return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
      }
    }

    const aspect_ratio = (model.supportedRatios && !model.supportedRatios.includes(requestedRatio))
      ? (model.supportedRatios.includes('4:3') ? '4:3' : '1:1')
      : requestedRatio;

    const provider  = getProvider(model.provider);
    const startTime = Date.now();

    try {
      const result = await provider.generate(
        { prompt, aspectRatio: aspect_ratio, megapixels, outputFormat, referenceImage: body.reference_image },
        apiKey,
        model.modelId,
      );
      const durationMs = Date.now() - startTime;

      if (!result.url || !result.url.startsWith('http')) {
        throw new Error(`${model.displayName} returned invalid image URL`);
      }

      if (!model.byokOnly && !creditCheck.byok) {
        await deductCredit(session.user.id, model.creditType);
      }

      await logUsage({
        userId:     session.user.id,
        modelAlias: alias,
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

      return processBuffer(result.url, targetW, targetH, outputFormat, alias);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      lastError = err instanceof Error ? err.message : 'Generation failed';
      console.error(`[studio/generate][${alias}] failed, ${candidates.length > 1 ? 'trying next...' : 'no fallback'}`, lastError);

      await logUsage({
        userId:       session.user.id,
        modelAlias:   alias,
        provider:     model.provider,
        modelId:      model.modelId,
        operation:    'generate',
        status:       'error',
        durationMs,
        costUsd:      0,
        creditCost:   0,
        byok:         model.byokOnly ?? false,
        errorMessage: lastError,
      });
    }
  }

  return NextResponse.json({ error: lastError }, { status: 500 });
}
