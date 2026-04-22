import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const MAX_W = 1440;
const MAX_H = 1440;

// ── In-memory rate limiter (per IP, 5 req/min) ────────────────────────────────
const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now   = Date.now();
  const entry = rl.get(ip);
  if (!entry || now > entry.reset) {
    rl.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

interface GenerateBody {
  prompt: string;
  width?:  number;
  height?: number;
}

export async function POST(request: Request) {
  // ── Feature flag ─────────────────────────────────────────────────────────────
  if (process.env.REPLICATE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Image generation is disabled' }, { status: 503 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Missing API token' }, { status: 500 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Too many requests — max 5/min' }, { status: 429 });
  }

  // ── Validate body ─────────────────────────────────────────────────────────────
  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const width  = Math.min(Math.max(Number(body.width  ?? 1024), 256), MAX_W);
  const height = Math.min(Math.max(Number(body.height ?? 768),  256), MAX_H);

  // ── Run Flux Schnell ──────────────────────────────────────────────────────────
  const replicate = new Replicate({ auth: token });

  try {
    const output = await replicate.run(
      'black-forest-labs/flux-schnell',
      {
        input: {
          prompt,
          width,
          height,
          num_outputs:         1,
          num_inference_steps: 4,
          output_format:       'webp',
          output_quality:      90,
        },
      },
    );

    // SDK returns an array of URLs (or ReadableStream objects for file outputs)
    const urls = output as unknown[];
    const first = urls?.[0];

    // Handle both plain URL strings and Replicate FileOutput objects
    let imageUrl: string | null = null;
    if (typeof first === 'string') {
      imageUrl = first;
    } else if (first && typeof (first as { url?: () => string | URL }).url === 'function') {
      const result = (first as { url: () => string | URL }).url();
      imageUrl = result instanceof URL ? result.toString() : result;
    } else if (first instanceof URL) {
      imageUrl = first.toString();
    }

    if (!imageUrl) {
      console.error('Unexpected Replicate output:', JSON.stringify(output));
      return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('Replicate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
