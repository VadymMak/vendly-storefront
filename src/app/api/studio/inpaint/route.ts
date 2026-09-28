import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { createJob } from '@/lib/studio-jobs';
import { db } from '@/lib/db';
import { checkCredits, consumeCredits, getOrCreateCredits } from '@/lib/credits';
import { checkRateLimitWithBypass, RATE_LIMITS } from '@/lib/rate-limit';
import { isAbusivePrompt } from '@/lib/spam-check';
import { translatePromptToEnglish } from '@/lib/studio/translate-prompt';

export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Must match the "Fill strength" slider in InpaintEditor — the value shown is the value sent
const MIN_GUIDANCE = 10;
const MAX_GUIDANCE = 50;

const REMOVAL_PROMPT = 'matching surrounding texture and background, continuous surface, natural lighting and shadows';

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credits  = await getOrCreateCredits(session.user.id);
  const planType = (credits.planType || 'free') as keyof typeof RATE_LIMITS.aiEdit;
  const rateLimit = RATE_LIMITS.aiEdit[planType] || RATE_LIMITS.aiEdit.free;
  if (!(await checkRateLimitWithBypass(`inpaint:${ip}:${session.user.id}`, rateLimit, session.user.id))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const creditCheck = await checkCredits(session.user.id, 'image', 1, 'replicate');
  if (!creditCheck.allowed) {
    return NextResponse.json({ error: creditCheck.reason ?? 'Insufficient credits' }, { status: 402 });
  }

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const mask = formData.get('mask') as File | null;
    const userPrompt = ((formData.get('prompt') as string) || '').trim();
    const userGuidance = parseFloat((formData.get('guidance') as string) || '');
    const parsedSteps = parseInt((formData.get('steps') as string) || '', 10);
    const steps = Number.isFinite(parsedSteps) ? Math.max(1, Math.min(50, parsedSteps)) : 50;

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }
    if (!mask) {
      return NextResponse.json({ error: 'Missing mask' }, { status: 400 });
    }
    if (userPrompt && isAbusivePrompt(userPrompt)) {
      return NextResponse.json({ error: 'Please enter a valid description' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 500 });
    }

    console.log('[inpaint] Uploading image and mask to Vercel Blob...');

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBlob = await put(`studio/inpaint/${Date.now()}-src.png`, imageBuffer, {
      access: 'public',
      contentType: image.type || 'image/png',
    });
    console.log('[inpaint] Image uploaded:', imageBlob.url);

    const maskBuffer = Buffer.from(await mask.arrayBuffer());
    const maskBlob = await put(`studio/inpaint/${Date.now()}-mask.png`, maskBuffer, {
      access: 'public',
      contentType: 'image/png',
    });
    console.log('[inpaint] Mask uploaded:', maskBlob.url);

    const isRemoval = !userPrompt;

    // Mode-specific default only when the client sends nothing; otherwise honour the slider
    const guidance = Number.isFinite(userGuidance)
      ? Math.max(MIN_GUIDANCE, Math.min(MAX_GUIDANCE, userGuidance))
      : isRemoval ? 20 : 30;

    // Flux Fill understands English only — translate after all checks so rejected requests don't pay for OpenAI
    const prompt = isRemoval
      ? REMOVAL_PROMPT
      : await translatePromptToEnglish(userPrompt, (await cookies()).get('locale')?.value);

    // Log metadata only — user prompts are personal content (GDPR)
    console.log('[inpaint] Mode:', isRemoval ? 'REMOVAL' : 'REPLACEMENT', '| guidance:', guidance, '| prompt chars:', userPrompt.length);

    const replicate = new Replicate({ auth: token });

    const output = await replicate.run('black-forest-labs/flux-fill-pro', {
      input: {
        image: imageBlob.url,
        mask: maskBlob.url,
        prompt,
        guidance,
        steps,
        output_format: 'jpg',
        prompt_upsampling: false,
      },
    });

    console.log('[inpaint] Replicate output type:', typeof output, Array.isArray(output) ? 'array' : '');

    let imageUrl: string | null = null;

    if (typeof output === 'string') {
      imageUrl = output;
    } else if (Array.isArray(output)) {
      const first = output[0];
      if (typeof first === 'string') {
        imageUrl = first;
      } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
        const result = (first as { url: () => string | URL }).url();
        imageUrl = result instanceof URL ? result.toString() : result;
      } else if (first instanceof URL) {
        imageUrl = first.toString();
      }
    } else if (output && typeof (output as { url?: () => string | URL }).url === 'function') {
      const result = (output as { url: () => string | URL }).url();
      imageUrl = result instanceof URL ? result.toString() : result;
    }

    if (!imageUrl) {
      console.error('[inpaint] Unexpected Replicate output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No image URL in Replicate response' }, { status: 500 });
    }

    console.log('[inpaint] Got result URL, re-uploading to blob storage...');

    const imgRes = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const finalBlob = await put(`studio/inpaint/${Date.now()}-result.webp`, imgBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    console.log('[inpaint] Done:', finalBlob.url);
    const consume = await consumeCredits(session.user.id, 'image', 1, 'replicate');
    if (!consume.success) {
      return NextResponse.json({ error: consume.reason ?? 'Insufficient credits' }, { status: 402 });
    }
    const capturedUrl = finalBlob.url;
    createJob({
      userId:       session.user.id,
      predictionId: `inpaint:${Date.now()}`,
      type:         'ai-edit',
      creditType:   'image',
      creditAmount: 1,
      metadata:     { prompt: userPrompt, modelUsed: 'flux-fill-pro', provider: 'replicate' },
    }).then(async (jobId) => {
      await db.studioJob.update({
        where: { id: jobId },
        data:  { status: 'succeeded', outputUrl: capturedUrl },
      });
    }).catch((err) => {
      console.error('[inpaint] Failed to save to StudioJob:', err);
    });
    return NextResponse.json({ url: finalBlob.url });
  } catch (error) {
    console.error('[inpaint] Error:', error);
    const message = error instanceof Error ? error.message : 'Inpaint failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
