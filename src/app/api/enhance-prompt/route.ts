import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// ── Video skill system prompts (mirrors TestVideoClient) ──────────────────────

const VIDEO_SKILL_PROMPTS: Record<string, string> = {
  'aiedit': 'You are an expert at writing editing instructions for the InstructPix2Pix image editing model. Transform the user\'s rough description into a concise, precise editing instruction. Use action language: "make it...", "change ... to ...", "add ...", "remove ...", "convert to...". Keep it under 15 words. Output ONLY the enhanced instruction.',
  'ig-reel':   'You are a creative director for Instagram Reels. Transform the user input into a cinematic, visually engaging video prompt optimized for vertical 9:16 format. Focus on dynamic motion, vibrant colors, trend-forward aesthetics, and hook within the first second. Output ONLY the enhanced prompt, no explanations.',
  'ig-story':  'You are a social media content director specializing in Instagram Stories. Transform the user input into a visually compelling 9:16 video prompt with a clear narrative arc fitting 5 seconds. Output ONLY the enhanced prompt.',
  'ig-post':   'You are a visual content creator for Instagram feed posts. Transform the user input into a square 1:1 video prompt with polished, editorial aesthetics. Output ONLY the enhanced prompt.',
  'yt-shorts': 'You are a YouTube Shorts content strategist. Transform the user input into an engaging 9:16 vertical video prompt designed to maximize watch time for 10 seconds. Output ONLY the enhanced prompt.',
  'tiktok':    'You are a TikTok creative director. Transform the user input into a viral-optimized 9:16 video prompt. Prioritize authenticity, trending visual language, and a surprising element. Output ONLY the enhanced prompt.',
  'cinematic': 'You are a cinematic director of photography. Transform the user input into a high-end cinematic video prompt in 16:9 widescreen. Describe lighting, camera movement, depth of field, and mood precisely. Output ONLY the enhanced prompt.',
  'product':   'You are an e-commerce video director. Transform the user input into a clean product showcase video prompt in 1:1. Focus on 360° reveal, material texture, subtle motion, and premium feel. Output ONLY the enhanced prompt.',
};

interface EnhanceBody {
  prompt:      string;
  // legacy image mode
  enhanceMode?: string;
  styleTags?:   string[];
  width?:       number;
  height?:      number;
  // video mode
  skillId?:     string;
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
  let body: EnhanceBody;
  try {
    body = await request.json() as EnhanceBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompt, enhanceMode, styleTags, width, height, skillId } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // ── Video mode: use user's personal Anthropic key ─────────────────────────
  let apiKey: string | undefined;
  let system: string;
  let userMsg: string;

  if (skillId) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const keyRecord = await db.userApiKey.findUnique({
      where: { userId_provider: { userId: session.user.id, provider: 'anthropic' } },
    });
    if (!keyRecord) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 400 });

    apiKey = decrypt(keyRecord.encryptedKey);
    system = VIDEO_SKILL_PROMPTS[skillId] ?? VIDEO_SKILL_PROMPTS['cinematic'];
    userMsg = `Raw idea: "${prompt.trim()}"\n\nEnhance this into an optimal video generation prompt:`;
  } else {
    // ── Legacy image mode: use server key ──────────────────────────────────
    apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });

    const modeLabel   = MODE_LABELS[enhanceMode ?? ''] ?? (enhanceMode ?? 'image');
    const w = width ?? 1200;
    const h = height ?? 630;
    const orientation = w > h ? 'landscape (wide)' : w < h ? 'portrait (tall)' : 'square';
    const tagsStr     = (styleTags ?? []).length > 0 ? (styleTags ?? []).join(', ') : 'none specified';

    system = `You are an expert AI image prompt engineer specializing in Flux Schnell diffusion model prompts.
Transform the user's raw idea into a highly detailed, effective image generation prompt.
Rules:
- Be specific about lighting, composition, style, atmosphere, colors, and textures
- Weave style modifiers naturally into the narrative — don't list them separately
- Tailor the prompt for the use case: ${modeLabel}
- Account for ${orientation} orientation at ${w}×${h} px
- Always end with: , high quality, 4K, commercial photography, no text, no watermark
- Return ONLY the enhanced prompt — no explanations, no quotes, no labels`;

    userMsg = `Raw idea: "${prompt.trim()}"
Style modifiers to incorporate: ${tagsStr}

Write the enhanced Flux Schnell prompt:`;
  }

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
