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
      model: 'grok-imagine-image',
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
      model: 'grok-imagine-image',
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
