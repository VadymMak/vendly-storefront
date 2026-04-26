import { NextResponse } from 'next/server';

interface EnhanceBody {
  prompt:      string;
  enhanceMode: string;
  styleTags:   string[];
  width:       number;
  height:      number;
}

const MODE_LABELS: Record<string, string> = {
  og:       'OG / social media banner',
  hero:     'hero / landing page image',
  product:  'e-commerce product photo',
  interior: 'interior / place atmosphere',
  food:     'food / menu photography',
  abstract: 'abstract / decorative artwork',
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });
  }

  let body: EnhanceBody;
  try {
    body = await request.json() as EnhanceBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompt, enhanceMode, styleTags, width, height } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const modeLabel   = MODE_LABELS[enhanceMode] ?? enhanceMode;
  const orientation = width > height ? 'landscape (wide)' : width < height ? 'portrait (tall)' : 'square';
  const tagsStr     = styleTags.length > 0 ? styleTags.join(', ') : 'none specified';

  const system = `You are an expert AI image prompt engineer specializing in Flux Schnell diffusion model prompts.
Transform the user's raw idea into a highly detailed, effective image generation prompt.
Rules:
- Be specific about lighting, composition, style, atmosphere, colors, and textures
- Weave style modifiers naturally into the narrative — don't list them separately
- Tailor the prompt for the use case: ${modeLabel}
- Account for ${orientation} orientation at ${width}×${height} px
- Always end with: , high quality, 4K, commercial photography, no text, no watermark
- Return ONLY the enhanced prompt — no explanations, no quotes, no labels`;

  const userMsg = `Raw idea: "${prompt.trim()}"
Style modifiers to incorporate: ${tagsStr}

Write the enhanced Flux Schnell prompt:`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 512,
        system,
        messages:   [{ role: 'user', content: userMsg }],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Anthropic API error:', errData);
      return NextResponse.json({ error: 'Enhancement failed' }, { status: 500 });
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const enhanced = data.content.find(b => b.type === 'text')?.text?.trim();

    if (!enhanced) {
      return NextResponse.json({ error: 'Enhancement returned empty response' }, { status: 500 });
    }

    return NextResponse.json({ enhanced });
  } catch (err) {
    console.error('Anthropic fetch error:', err);
    return NextResponse.json({ error: 'Enhancement failed' }, { status: 500 });
  }
}
