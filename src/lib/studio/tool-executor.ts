import { put } from '@vercel/blob';
import type { ToolName, MediaAttachment } from './types';

interface ToolResult {
  media?: MediaAttachment;
  message?: string;
  jobId?: string;
  error?: string;
}

const BASE_URL =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function executeTool(
  tool: ToolName,
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null; lastVideoUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  try {
    switch (tool) {
      case 'generate_image':
        return await executeGenerateImage(params, cookieHeader);
      case 'image_to_video':
        return await executeGenerateVideo(params, context, cookieHeader);
      case 'edit_image':
        return await executeEditImage(params, context, cookieHeader);
      case 'upscale':
      case 'face_enhance':
        return await executeEnhanceImage(tool, params, context, cookieHeader);
      case 'remove_background':
        return await executeRemoveBg(context, cookieHeader);
      case 'write_caption':
        return await executeWriteCaption(params);
      default:
        return { error: `Unknown tool: ${tool}` };
    }
  } catch (error) {
    console.error(`[tool-executor] ${tool} failed:`, error);
    return { error: `Failed to execute ${tool}. Please try again.` };
  }
}

async function executeGenerateImage(
  params: Record<string, string | number | boolean>,
  cookieHeader: string,
): Promise<ToolResult> {
  const res = await fetch(`${BASE_URL}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      prompt: params.prompt || '',
      aspect_ratio: params.aspect_ratio || '1:1',
      output_format: 'webp',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Image generation failed' })) as { error?: string };
    return { error: err.error || 'Image generation failed' };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/webp';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp';

  const blob = await put(`studio/chat/${Date.now()}.${ext}`, buffer, {
    access: 'public',
    contentType,
  });

  return { media: { type: 'image', url: blob.url } };
}

async function executeGenerateVideo(
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in context. Please generate or upload an image first.' };
  }

  const rawDuration = Number(params.duration);
  const duration = rawDuration === 10 ? 10 : 5;
  const validRatios = ['9:16', '1:1', '16:9'] as const;
  const aspectRatio = validRatios.includes(params.aspectRatio as typeof validRatios[number])
    ? (params.aspectRatio as string)
    : '9:16';

  const res = await fetch(`${BASE_URL}/api/generate-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      prompt: params.prompt || 'Smooth cinematic motion',
      skillId: 'agent-video',
      aspectRatio,
      duration,
      startImage: context.lastImageUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Video generation failed' })) as { error?: string };
    return { error: err.error || 'Video generation failed' };
  }

  const data = await res.json() as { jobId?: string };
  return {
    jobId: data.jobId,
    message: 'Video generation started. This takes 2-3 minutes...',
  };
}

async function executeEditImage(
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in context. Please generate or upload an image first.' };
  }

  const imageRes = await fetch(context.lastImageUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const imageBlob = new Blob([imageBuffer], { type: 'image/webp' });

  const formData = new FormData();
  formData.append('image', imageBlob, 'input.webp');
  formData.append('prompt', String(params.prompt || 'improve this image'));

  const res = await fetch(`${BASE_URL}/api/ai-edit`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Image edit failed' })) as { error?: string };
    return { error: err.error || 'Image edit failed' };
  }

  const data = await res.json() as { url?: string };
  return { media: { type: 'image', url: data.url! } };
}

async function executeEnhanceImage(
  tool: 'upscale' | 'face_enhance',
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in context. Please generate or upload an image first.' };
  }

  const imageRes = await fetch(context.lastImageUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const imageBlob = new Blob([imageBuffer], { type: 'image/webp' });

  const formData = new FormData();
  formData.append('image', imageBlob, 'input.webp');
  formData.append('type', tool === 'face_enhance' ? 'portrait' : String(params.type || 'upscale'));

  const res = await fetch(`${BASE_URL}/api/enhance-image`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Enhancement failed' })) as { error?: string };
    return { error: err.error || 'Enhancement failed' };
  }

  const data = await res.json() as { url?: string };
  return { media: { type: 'image', url: data.url! } };
}

async function executeRemoveBg(
  context: { lastImageUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in context. Please generate or upload an image first.' };
  }

  const imageRes = await fetch(context.lastImageUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const imageBlob = new Blob([imageBuffer], { type: 'image/webp' });

  const formData = new FormData();
  formData.append('image', imageBlob, 'input.webp');

  const res = await fetch(`${BASE_URL}/api/remove-bg`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Background removal failed' })) as { error?: string };
    return { error: err.error || 'Background removal failed' };
  }

  const data = await res.json() as { url?: string };
  return { media: { type: 'image', url: data.url! } };
}

async function executeWriteCaption(
  params: Record<string, string | number | boolean>,
): Promise<ToolResult> {
  const platform = String(params.platform || 'instagram');
  const topic = String(params.topic || 'this product');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are a social media copywriter. Write an engaging ${platform} caption about the given topic. Include relevant hashtags (8-12). Keep it concise, authentic, and optimized for ${platform} algorithm. Use line breaks for readability. Write in English.`,
          },
          {
            role: 'user',
            content: `Write a ${platform} caption about: ${topic}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { error: 'Caption generation failed' };
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const caption = data.choices?.[0]?.message?.content || 'Could not generate caption';
    return { message: caption };
  } catch {
    return { error: 'Caption generation failed. Check OPENAI_API_KEY.' };
  }
}
