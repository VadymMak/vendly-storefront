import { put } from '@vercel/blob';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkCredits, deductCredit, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { getModel } from '@/lib/studio/config';
import { getProvider } from '@/lib/studio/providers';
import { resolveApiKey } from '@/lib/studio/resolve';
import { logUsage } from '@/lib/studio/usage-logger';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // Honeypot
  if (formData.get('website')) return NextResponse.json({ success: true });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const file       = formData.get('image') as File | null;
  const prompt     = (formData.get('prompt') as string | null)?.trim() ?? '';
  // Accept modelAlias (new) or provider (legacy); no modelAlias → edit-kontext (Flux)
  const modelAlias = (formData.get('modelAlias') as string | null)
    ?? (formData.get('provider') === 'grok' ? 'edit-grok' : 'edit-kontext');

  if (!file)   return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

  // Rate limit
  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as 'free' | 'starter' | 'pro';

  if (!(await checkRateLimitWithBypass(`edit:${ip}:${session.user.id}`, RATE_LIMITS.aiEdit[planType], session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  if (isAbusivePrompt(prompt)) {
    return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
  }

  const model = getModel(modelAlias);
  if (!model || model.operation !== 'edit') {
    return NextResponse.json({ error: `Unknown edit model: ${modelAlias}` }, { status: 400 });
  }
  // Check provider supports edit
  const provider = getProvider(model.provider);
  if (!provider.edit) {
    return NextResponse.json({ error: `Provider "${model.provider}" does not support editing` }, { status: 400 });
  }

  // Resolve API key
  const apiKey = await resolveApiKey(session.user.id, model);
  if (!apiKey) {
    return NextResponse.json(
      { error: `${model.displayName} API key not configured. Add it in Settings → API Keys.` },
      { status: 400 },
    );
  }

  // Credit check
  let creditCheck: { allowed: boolean; byok?: boolean; reason?: string } = { allowed: true, byok: true };
  if (!model.byokOnly) {
    creditCheck = await checkCredits(session.user.id, model.creditType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason, needsUpgrade: true }, { status: 403 });
    }
  }

  // Resize + upload image to blob storage
  const bytes   = await file.arrayBuffer();
  const maxSize = model.maxInputSize ?? 1024;
  const resized = await sharp(Buffer.from(bytes))
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const blob = await put(
    `studio/ai-edit/${session.user.id}/${Date.now()}.png`,
    resized,
    { access: 'public', contentType: 'image/png' },
  );

  const startTime = Date.now();

  try {
    const result = await provider.edit!(
      { prompt, imageUrl: blob.url },
      apiKey,
      model.modelId,
    );
    const durationMs = Date.now() - startTime;

    if (!model.byokOnly && !creditCheck.byok) {
      await deductCredit(session.user.id, model.creditType);
    }

    await logUsage({
      userId:     session.user.id,
      modelAlias,
      provider:   model.provider,
      modelId:    model.modelId,
      operation:  'edit',
      status:     'success',
      durationMs,
      costUsd:    model.costPerCall,
      creditCost: model.byokOnly ? 0 : model.creditCost,
      byok:       model.byokOnly ?? (creditCheck.byok ?? false),
      metadata:   { promptLength: prompt.length },
    });

    const capturedUrl = result.url;
    createJob({
      userId:       session.user.id,
      predictionId: `img:${modelAlias}:${Date.now()}`,
      type:         'ai-edit',
      creditType:   model.byokOnly ? undefined : 'image',
      creditAmount: model.byokOnly ? 0 : model.creditCost,
      metadata: {
        prompt,
        modelUsed: modelAlias,
        provider:  model.provider,
      },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => {
      console.error('[studio/edit] Failed to save to StudioJob:', err);
    });

    return NextResponse.json({ url: result.url });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : 'Edit failed';
    await logUsage({
      userId:       session.user.id,
      modelAlias,
      provider:     model.provider,
      modelId:      model.modelId,
      operation:    'edit',
      status:       'error',
      durationMs,
      costUsd:      0,
      creditCost:   0,
      byok:         model.byokOnly ?? false,
      errorMessage: msg,
    });
    console.error(`[studio/edit][${modelAlias}]`, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
