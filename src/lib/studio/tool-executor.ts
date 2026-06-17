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

const BRAIN_URL = process.env.BRAIN_API_URL || 'https://multi-ai-chat-production.up.railway.app';
const MAX_UPSCALE_PIXELS = 2_000_000; // Real-ESRGAN GPU limit ~2.09M, use 2M as safe margin

function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG: bytes 16-23 contain width/height as 4-byte big-endian
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: scan for SOF0 (0xFF 0xC0) or SOF2 (0xFF 0xC2) marker
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  // WebP: RIFF....WEBPVP8x
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
    const sub = buffer[15];
    if (sub === 0x20) { // VP8 lossy
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (sub === 0x4c) { // VP8L lossless
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (sub === 0x58) { // VP8X extended
      return {
        width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
        height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
      };
    }
  }

  return null;
}

async function ensureWithinPixelLimit(
  imageBuffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string; wasResized: boolean }> {
  const dimensions = getImageDimensions(imageBuffer);
  if (!dimensions) {
    return { buffer: imageBuffer, contentType, wasResized: false };
  }

  const totalPixels = dimensions.width * dimensions.height;
  if (totalPixels <= MAX_UPSCALE_PIXELS) {
    return { buffer: imageBuffer, contentType, wasResized: false };
  }

  const scale = Math.sqrt(MAX_UPSCALE_PIXELS / totalPixels);
  const newWidth = Math.floor(dimensions.width * scale);
  const newHeight = Math.floor(dimensions.height * scale);

  console.log(
    `[tool-executor] Image ${dimensions.width}x${dimensions.height} (${totalPixels}px) exceeds limit. Resizing to ${newWidth}x${newHeight}`,
  );

  const formData = new FormData();
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: contentType }), 'input.webp');
  formData.append('width', String(newWidth));
  formData.append('height', String(newHeight));
  formData.append('format', 'webp');
  formData.append('quality', '95');

  const res = await fetch(`${BRAIN_URL}/api/transform-image`, { method: 'POST', body: formData });
  if (!res.ok) {
    console.error('[tool-executor] Brain resize failed:', res.status);
    return { buffer: imageBuffer, contentType, wasResized: false };
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'image/webp',
    wasResized: true,
  };
}

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
        if (String(params.model) === 'supir') {
          return await executeSupirUpscale(params, context, cookieHeader);
        }
        return await executeEnhanceImage(tool, params, context, cookieHeader);
      case 'remove_background':
        return await executeRemoveBg(context, cookieHeader);
      case 'transform_image':
        return await executeTransformImage(params, context, cookieHeader);
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
      provider: params.provider || 'flux',
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
  formData.append('provider', String(params.provider || 'flux'));

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
  const originalBuffer = Buffer.from(await imageRes.arrayBuffer());
  const originalContentType = imageRes.headers.get('content-type') || 'image/webp';

  // Auto-resize if image exceeds Real-ESRGAN GPU pixel limit
  const { buffer: imageBuffer, contentType } = await ensureWithinPixelLimit(
    originalBuffer,
    originalContentType,
  );

  const formData = new FormData();
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: contentType }), 'input.webp');
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

async function executeSupirUpscale(
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null },
  cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in session. Upload or generate an image first.' };
  }

  const imageRes = await fetch(context.lastImageUrl);
  const originalBuffer = Buffer.from(await imageRes.arrayBuffer());
  const originalContentType = imageRes.headers.get('content-type') || 'image/webp';

  const { buffer: imageBuffer, contentType } = await ensureWithinPixelLimit(
    originalBuffer,
    originalContentType,
  );

  const formData = new FormData();
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: contentType }), 'input.webp');
  formData.append('type', 'supir');
  formData.append('scale', String(params.scale || 2));
  if (params.quality_prompt) {
    formData.append('quality_prompt', String(params.quality_prompt));
  }

  const res = await fetch(`${BASE_URL}/api/enhance-image`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'SUPIR enhancement failed' })) as { error?: string };
    return { error: err.error || 'SUPIR enhancement failed' };
  }

  const data = await res.json() as { url?: string };
  return {
    message: '✨ Premium restoration complete! Clarity AI upscaler — maximum detail and sharpness.',
    media: { type: 'image', url: data.url! },
  };
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

async function executeTransformImage(
  params: Record<string, string | number | boolean>,
  context: { lastImageUrl: string | null },
  _cookieHeader: string,
): Promise<ToolResult> {
  if (!context.lastImageUrl) {
    return { error: 'No image in context. Please upload or generate an image first.' };
  }

  const imageRes = await fetch(context.lastImageUrl);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const contentType = imageRes.headers.get('content-type') || 'image/webp';

  const formData = new FormData();
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: contentType }), 'input.webp');
  if (params.preset) formData.append('preset', String(params.preset));
  if (params.width) formData.append('width', String(params.width));
  if (params.height) formData.append('height', String(params.height));
  if (params.quality) formData.append('quality', String(params.quality));
  if (params.format) formData.append('format', String(params.format));
  if (params.fit_mode) formData.append('fit_mode', String(params.fit_mode));
  if (params.crop) formData.append('crop', String(params.crop));

  const res = await fetch(`${BRAIN_URL}/api/transform-image`, { method: 'POST', body: formData });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[tool-executor] transform_image failed:', res.status, errorText);
    return { error: `Transform failed: ${res.statusText}` };
  }

  const resultBuffer = Buffer.from(await res.arrayBuffer());
  const resultContentType = res.headers.get('content-type') || 'image/webp';
  const ext = resultContentType.includes('png') ? 'png' : resultContentType.includes('jpeg') ? 'jpg' : 'webp';

  const dimensions = res.headers.get('X-Dimensions');
  console.log(`[tool-executor] transform_image done${dimensions ? ` (${dimensions})` : ''}`);

  const resultBlob = await put(`studio/chat/${Date.now()}-transformed.${ext}`, resultBuffer, {
    access: 'public',
    contentType: resultContentType,
  });

  return { media: { type: 'image', url: resultBlob.url } };
}
