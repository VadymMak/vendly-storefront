import Replicate from 'replicate';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

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
  prompt:         string;
  aspect_ratio?:  string;
  megapixels?:    string;
  target_width?:  number;
  target_height?: number;
  output_format?: 'webp' | 'png' | 'jpeg';
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

  const aspect_ratio     = body.aspect_ratio ?? '1:1';
  const megapixels       = body.megapixels   ?? '1';
  const targetW          = body.target_width;
  const targetH          = body.target_height;
  const requested_format = ['webp', 'png', 'jpeg'].includes(body.output_format ?? '')
    ? (body.output_format as 'webp' | 'png' | 'jpeg')
    : 'webp';
  // Flux Schnell doesn't support jpeg output — generate png, convert via Sharp
  const replicate_format = requested_format === 'jpeg' ? 'png' : requested_format;

  console.log('API received:', { aspect_ratio, megapixels, targetW, targetH, requested_format });

  // ── Run Flux Schnell ──────────────────────────────────────────────────────────
  const replicate = new Replicate({ auth: token });

  try {
    const output = await replicate.run(
      'black-forest-labs/flux-schnell',
      {
        input: {
          prompt,
          aspect_ratio,
          megapixels,
          num_outputs:         1,
          num_inference_steps: 4,
          output_format:       replicate_format,
          output_quality:      90,
          go_fast:             true,
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

    // ── Fetch Flux output + Sharp resize to exact target dimensions ───────────
    const fluxRes    = await fetch(imageUrl);
    const inputBuf   = Buffer.from(await fluxRes.arrayBuffer());
    const pipeline   = sharp(inputBuf);

    if (targetW && targetH) {
      pipeline.resize(targetW, targetH, { fit: 'fill' });
    }

    let resized: Buffer;
    let contentType: string;
    let ext: string;

    if (requested_format === 'jpeg') {
      resized      = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      contentType  = 'image/jpeg';
      ext          = 'jpg';
    } else if (requested_format === 'png') {
      resized      = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      contentType  = 'image/png';
      ext          = 'png';
    } else {
      resized      = await pipeline.webp({ quality: 90 }).toBuffer();
      contentType  = 'image/webp';
      ext          = 'webp';
    }

    const name = targetW && targetH
      ? `flux-${targetW}x${targetH}-${Date.now()}.${ext}`
      : `flux-${Date.now()}.${ext}`;

    return new Response(new Uint8Array(resized), {
      headers: {
        'Content-Type':        contentType,
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('Replicate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
