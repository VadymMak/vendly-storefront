interface GrokImageResponse {
  data: Array<{ url?: string; b64_json?: string }>;
  created?: number;
}

interface GrokErrorResponse {
  code?:  string;
  error?: string;
}

function parseGrokError(status: number, raw: string): string {
  try {
    const body = JSON.parse(raw) as GrokErrorResponse;
    const msg  = body.error ?? '';
    if (msg.toLowerCase().includes('content moderation')) {
      return 'Grok content moderation blocked this request. Try a different prompt, or switch to Flux ⚡ provider.';
    }
    if (msg.toLowerCase().includes('incorrect api key') || msg.toLowerCase().includes('invalid argument')) {
      return `xAI API key error: ${msg}`;
    }
    if (msg) return msg;
  } catch {
    // raw is not JSON
  }
  return `xAI API error ${status}`;
}

export async function grokGenerate(apiKey: string, prompt: string, size?: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-2.0',
      prompt,
      n: 1,
      response_format: 'url',
      ...(size ? { size } : {}),
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(parseGrokError(res.status, raw));
  }

  const data = await res.json() as GrokImageResponse;
  const url  = data.data?.[0]?.url;
  if (!url) throw new Error('xAI returned no image URL');
  return url;
}

export async function grokEdit(apiKey: string, imageUrl: string, prompt: string, size?: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-2.0',
      image: { url: imageUrl },
      prompt,
      n: 1,
      response_format: 'url',
      ...(size ? { size } : {}),
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(parseGrokError(res.status, raw));
  }

  const data = await res.json() as GrokImageResponse;
  const url  = data.data?.[0]?.url;
  if (!url) throw new Error('xAI edit returned no image URL');
  return url;
}

export async function grokMultiImageEdit(
  apiKey: string,
  imageUrls: string[],
  prompt: string,
  aspectRatio?: string
): Promise<string> {
  if (imageUrls.length === 0) throw new Error('At least one image URL is required');
  if (imageUrls.length > 5) throw new Error('Maximum 5 images per request');

  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-2.0',
      images: imageUrls.map(url => ({ type: 'image_url', url })),
      prompt,
      n: 1,
      response_format: 'url',
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(parseGrokError(res.status, raw));
  }

  const data = (await res.json()) as GrokImageResponse;
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('xAI multi-image edit returned no image URL');
  return url;
}
