import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkCredits, consumeCredits, getOrCreateCredits, isSuperuser, hasUserApiKey } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { getModel, LEGACY_GENERATE_ALIAS, TIER_ROUTES, MODEL_CATALOG, type ModelEntry } from '@/lib/studio/config';
import { getProvider } from '@/lib/studio/providers';
import { resolveApiKey } from '@/lib/studio/resolve';
import { logUsage } from '@/lib/studio/usage-logger';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';
import { translatePromptToEnglish } from '@/lib/studio/translate-prompt';
import { STYLE_CHIPS } from '@/lib/studio/constants';

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
  // Sent only by the mobile Create wizard. Together with reference_image it switches
  // generation to img2img (Kontext). Chat tools send reference_image alone (Flux Redux
  // style reference) and stay on text-to-image.
  style_id?:        string;
  website?:         string;
}

/**
 * When the user uploads a photo and we route to img2img (Kontext), the style prompt must
 * be an EDIT INSTRUCTION, not a scene description. Text-to-image prompts say "create X";
 * img2img prompts say "preserve X, improve Y".
 */
const IMG2IMG_STYLE_PREFIX: Record<string, string> = {
  social:   'Transform this photo into polished professional social media photography. Keep the same subject, scene, objects and composition. Make the lighting noticeably brighter and more natural. Lift dark shadows, improve exposure and color balance, add depth and contrast. Create a premium editorial look while keeping the scene authentic.',
  product:  'Transform this photo into polished professional product photography. Preserve the exact product, shape, proportions, branding and colors. Improve studio lighting, exposure, contrast and material definition. Create a clean premium presentation with a realistic soft shadow. Keep the product itself unchanged.',
  food:     'Transform this photo into polished professional café marketing photography. Keep the same café, food, furniture, architecture and overall composition. Make the lighting noticeably brighter, warmer and more natural. Lift dark shadows, improve exposure and color balance, add rich but realistic depth and contrast. Make existing food look fresh and appetizing. Create a premium editorial photography look while keeping the scene authentic to the original business.',
  beauty:   'Transform this photo into polished professional beauty editorial photography. Preserve the same person, hairstyle, face and salon environment. Improve soft natural lighting, skin tone, color balance and depth. Create a clean premium beauty look. Keep facial identity and physical appearance unchanged.',
  interior: 'Transform this photo into polished professional interior photography. Preserve the same room, architecture, furniture and layout. Make the space noticeably brighter with natural balanced light. Lift shadows, improve white balance, depth and contrast. Make surfaces look clean and refined. Create a polished architectural-editorial photography look.',
  custom:   'Transform this photo into polished professional photography. Keep the same subject, scene and composition. Make the lighting brighter and more natural. Lift shadows, improve color balance, depth and contrast. Create a premium editorial look while keeping the scene authentic.',
};

// Edit verbs that make user text worth appending to an img2img prompt. Scene descriptions
// ("cozy café, warm atmosphere") restate what the photo already shows, so they are dropped.
// Bare "warm"/"cool" are left out because they are usually adjectives in scene descriptions.
// Lookarounds instead of \b: JS \b is ASCII-only, so it never matches around Cyrillic.
const IMG2IMG_ACTION_WORDS = /(?<!\p{L})(make|add|remove|change|replace|clean|brighten|darken|sharpen|blur|soften|crop|lighter|brighter|darker|warmer|cooler|fix|improve|increase|decrease|reduce|lift|boost|сделай|убери|добавь|измени|замени|почисти|ярче|темнее|теплее|холоднее|убрать|очистить|удалить|улучшить|усилить|зроби|прибери|додай|зміни|заміни|почисть|яскравіше|темніше|тепліше|холодніше|прибрати|видалити|покращити|посилити)(?!\p{L})/iu;

/** Closest ratio the model accepts, e.g. 4:5 → 3:4 for Kontext (which has no 4:5). */
function closestRatio(requested: string, supported: string[]): string {
  if (supported.includes(requested)) return requested;
  const value = (r: string) => { const [w, h] = r.split(':').map(Number); return w / h; };
  const target = value(requested);
  if (!Number.isFinite(target)) return '1:1';
  return supported.reduce((best, r) =>
    Math.abs(Math.log(value(r) / target)) < Math.abs(Math.log(value(best) / target)) ? r : best,
  );
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
  // 'cover' crops to the target ratio; 'fill' would stretch when the model's ratio differs.
  if (targetW && targetH) pipe.resize(targetW, targetH, { fit: 'cover', position: 'centre' });

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

  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as keyof typeof RATE_LIMITS.generateImage;

  // Credit check first — clear message beats a rate-limit error for exhausted users
  const quickCreditCheck = await checkCredits(session.user.id, 'image');
  if (!quickCreditCheck.allowed) {
    return NextResponse.json({ error: quickCreditCheck.reason, needsUpgrade: true }, { status: 403 });
  }

  // Force free users to fast tier only — skip if user has purchased bonus credits
  const hasPaidCredits = credits.bonusImages > 0 || credits.bonusVideos > 0;
  if (planType === 'free' && !quickCreditCheck.byok && !(await isSuperuser(session.user.id)) && !hasPaidCredits) {
    if (body.tier === 'quality' || body.tier === 'premium') {
      body.tier = 'fast';
    }
    if (body.modelAlias && !['img-fast', 'fal-schnell', 'img-grok'].includes(body.modelAlias)) {
      delete body.modelAlias;
      body.tier = 'fast';
    }
    body.provider = undefined;
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await checkRateLimitWithBypass(`img:${ip}:${session.user.id}`, RATE_LIMITS.generateImage[planType], session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  if (isAbusivePrompt(prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  const requestedRatio = body.aspect_ratio ?? '1:1';
  const megapixels     = body.megapixels   ?? '1';
  const targetW        = body.target_width;
  const targetH        = body.target_height;
  const outputFormat   = (['webp', 'png', 'jpeg'].includes(body.output_format ?? ''))
    ? (body.output_format as 'webp' | 'png' | 'jpeg')
    : 'webp';
  const uiLocale = (await cookies()).get('locale')?.value;

  // ── img2img: user uploaded a photo in the mobile wizard → transform it with Kontext ──
  if (body.reference_image && body.style_id) {
    if (!body.reference_image.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid reference image' }, { status: 400 });
    }
    const kontextModel = MODEL_CATALOG['fal-kontext'];
    const kontextKey   = kontextModel?.enabled ? await resolveApiKey(session.user.id, kontextModel) : null;
    if (kontextModel && kontextKey) {
      return generatePhotoTransform({
        userId:         session.user.id,
        model:          kontextModel,
        apiKey:         kontextKey,
        prompt,
        styleId:        body.style_id,
        referenceImage: body.reference_image,
        requestedRatio,
        targetW,
        targetH,
        outputFormat,
        uiLocale,
      });
    }
    // Kontext unavailable (no key / disabled) — fall through to text-to-image. The client
    // sees X-Generation-Mode: text_create and does not show a before/after comparison.
    console.warn('[studio/generate] reference_image present but Kontext unavailable, falling back to text-to-image');
  }

  // ── Resolve model alias ────────────────────────────────────────────────────

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

  // Translate only after auth, credit, rate-limit and abuse checks passed — the OpenAI
  // call is paid, so rejected requests must not trigger it. Done once for all candidates.
  const translatedPrompt = await translatePromptToEnglish(prompt, uiLocale);

  // ── Try each candidate until one succeeds ──────────────────────────────────

  let lastError = 'Generation failed';

  for (const { alias, model, apiKey } of candidates) {
    const creditCost = model.creditCost ?? 1;
    let creditCheck: { allowed: boolean; byok?: boolean; reason?: string } = { allowed: true, byok: true };
    if (!model.byokOnly) {
      creditCheck = await checkCredits(session.user.id, model.creditType, creditCost, model.apiKeyProvider);
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
        { prompt: translatedPrompt, aspectRatio: aspect_ratio, megapixels, outputFormat, referenceImage: body.reference_image },
        apiKey,
        model.modelId,
      );
      const durationMs = Date.now() - startTime;

      if (!result.url || !result.url.startsWith('http')) {
        throw new Error(`${model.displayName} returned invalid image URL`);
      }

      if (!model.byokOnly && !creditCheck.byok) {
        const consume = await consumeCredits(session.user.id, model.creditType, creditCost, model.apiKeyProvider);
        if (!consume.success) {
          return NextResponse.json({ error: consume.reason, needsUpgrade: true }, { status: 402 });
        }
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

      const response = await processBuffer(result.url, targetW, targetH, outputFormat, alias);
      response.headers.set('X-Model-Alias', alias);
      response.headers.set('X-Model-Provider', model.provider);
      response.headers.set('X-Model-Name', model.displayName);
      response.headers.set('X-Output-Url', result.url);
      response.headers.set('X-Generation-Mode', 'text_create');
      response.headers.set('Access-Control-Expose-Headers', 'X-Model-Alias, X-Model-Provider, X-Model-Name, X-Output-Url, X-Generation-Mode');

      // Fire-and-forget: persist to StudioJob so it appears in My Work
      const capturedUrl = result.url;
      createJob({
        userId:       session.user.id,
        predictionId: `img:${alias}:${Date.now()}`,
        type:         'image',
        creditType:   model.byokOnly ? undefined : 'image',
        creditAmount: model.byokOnly ? 0 : model.creditCost,
        metadata: {
          prompt,
          modelUsed:    alias,
          provider:     model.provider,
          aspect_ratio,
          outputFormat,
        },
      }).then(async (jobId) => {
        await db.studioJob.update({
          where: { id: jobId },
          data:  { status: 'succeeded', outputUrl: capturedUrl },
        });
      }).catch((err) => {
        console.error('[studio/generate] Failed to save to StudioJob:', err);
      });

      return response;
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

interface PhotoTransformParams {
  userId:         string;
  model:          ModelEntry;
  apiKey:         string;
  prompt:         string;
  styleId:        string;
  referenceImage: string;
  requestedRatio: string;
  targetW?:       number;
  targetH?:       number;
  outputFormat:   'webp' | 'png' | 'jpeg';
  uiLocale?:      string;
}

/**
 * img2img via Kontext. Never falls back to text-to-image: the user uploaded a photo and
 * expects it transformed, so a failure returns an error rather than an unrelated image.
 */
async function generatePhotoTransform(p: PhotoTransformParams): Promise<Response> {
  const { userId, model, apiKey, prompt, styleId, referenceImage, outputFormat } = p;
  const alias = 'fal-kontext';

  const creditCost = model.creditCost ?? 2;
  let creditCheck: { allowed: boolean; byok?: boolean; reason?: string } = { allowed: true, byok: true };
  if (!model.byokOnly) {
    creditCheck = await checkCredits(userId, model.creditType, creditCost, model.apiKeyProvider);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }
  }

  // The wizard sends "<text-to-image style prefix> <user text>". That prefix describes a
  // scene to create ("Professional food photography, warm lighting…") — sent to Kontext it
  // would invite a new scene, so strip it and keep only the user's own instruction.
  const t2iPrefix   = STYLE_CHIPS.find((s) => s.id === styleId)?.promptPrefix ?? '';
  const userText    = t2iPrefix && prompt.startsWith(t2iPrefix) ? prompt.slice(t2iPrefix.length).trim() : prompt;
  const hasAction   = IMG2IMG_ACTION_WORDS.test(userText);
  const instruction = hasAction ? await translatePromptToEnglish(userText, p.uiLocale) : '';
  const preservation = IMG2IMG_STYLE_PREFIX[styleId] ?? IMG2IMG_STYLE_PREFIX.custom;
  const img2imgPrompt = instruction
    ? `${preservation} Additional edit: ${instruction}`
    : preservation;

  // Don't send aspect_ratio to Kontext — it keeps the source photo's native framing.
  // Forcing e.g. landscape→portrait makes the model invent walls/furniture that don't exist.
  // The result is centre-cropped to the target size afterwards (processBuffer 'cover'), and
  // the Before/After slider object-covers the original to the same aspect, so they line up.
  // aspect_ratio is still computed for usage metadata.
  const aspect_ratio = model.supportedRatios ? closestRatio(p.requestedRatio, model.supportedRatios) : p.requestedRatio;
  const provider  = getProvider(model.provider);
  const startTime = Date.now();

  try {
    if (!provider.edit) throw new Error(`${model.displayName} does not support edit`);
    const result = await provider.edit(
      { prompt: img2imgPrompt, imageUrl: referenceImage },
      apiKey,
      model.modelId,
    );
    const durationMs = Date.now() - startTime;

    if (!result.url || !result.url.startsWith('http')) {
      throw new Error(`${model.displayName} returned invalid image URL`);
    }

    if (!model.byokOnly && !creditCheck.byok) {
      const consume = await consumeCredits(userId, model.creditType, creditCost, model.apiKeyProvider);
      if (!consume.success) {
        return NextResponse.json({ error: consume.reason, needsUpgrade: true }, { status: 402 });
      }
    }

    await logUsage({
      userId,
      modelAlias: alias,
      provider:   model.provider,
      modelId:    model.modelId,
      operation:  'edit',
      status:     'success',
      durationMs,
      costUsd:    model.costPerCall,
      creditCost: model.byokOnly ? 0 : model.creditCost,
      byok:       model.byokOnly ?? (creditCheck.byok ?? false),
      metadata:   { aspect_ratio, outputFormat, promptLength: prompt.length, generationMode: 'photo_transform' },
    });

    const response = await processBuffer(result.url, p.targetW, p.targetH, outputFormat, alias);
    response.headers.set('X-Model-Alias', alias);
    response.headers.set('X-Model-Provider', model.provider);
    response.headers.set('X-Model-Name', model.displayName);
    response.headers.set('X-Output-Url', result.url);
    response.headers.set('X-Generation-Mode', 'photo_transform');
    response.headers.set('Access-Control-Expose-Headers', 'X-Model-Alias, X-Model-Provider, X-Model-Name, X-Output-Url, X-Generation-Mode');

    // Fire-and-forget: persist to StudioJob so it appears in My Work
    const capturedUrl = result.url;
    createJob({
      userId,
      predictionId: `img:${alias}:${Date.now()}`,
      type:         'image',
      creditType:   model.byokOnly ? undefined : 'image',
      creditAmount: model.byokOnly ? 0 : model.creditCost,
      metadata: {
        prompt,
        modelUsed:      alias,
        provider:       model.provider,
        aspect_ratio,
        outputFormat,
        generationMode: 'photo_transform',
        referenceImage,
      },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => {
      console.error('[studio/generate] Failed to save img2img StudioJob:', err);
    });

    return response;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : 'img2img failed';
    console.error(`[studio/generate][${alias}] img2img failed:`, errMsg);

    await logUsage({
      userId,
      modelAlias:   alias,
      provider:     model.provider,
      modelId:      model.modelId,
      operation:    'edit',
      status:       'error',
      durationMs,
      costUsd:      0,
      creditCost:   0,
      byok:         model.byokOnly ?? false,
      errorMessage: errMsg,
    });

    return NextResponse.json(
      { error: 'Photo transformation failed. Please try again.', code: 'transform_failed' },
      { status: 500 },
    );
  }
}
