interface GrokImageResponse {
  data: Array<{ url?: string; b64_json?: string }>;
  created?: number;
}

export async function grokGenerate(apiKey: string, prompt: string, size = '1024x1024'): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-image-1212',
      prompt,
      n: 1,
      response_format: 'url',
      size,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`xAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as GrokImageResponse;
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('xAI returned no image URL');
  return url;
}

export async function grokEdit(apiKey: string, imageUrl: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-image-1212',
      image: imageUrl,
      prompt,
      n: 1,
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`xAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as GrokImageResponse;
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('xAI edit returned no image URL');
  return url;
}

export function aspectToGrokSize(ratio: string): string {
  if (ratio === '9:16' || ratio === '2:3' || ratio === '3:4') return '1024x1792';
  if (ratio === '16:9' || ratio === '3:2' || ratio === '4:3') return '1792x1024';
  return '1024x1024';
}
