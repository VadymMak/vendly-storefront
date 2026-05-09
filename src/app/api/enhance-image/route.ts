import Replicate from 'replicate';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const ENHANCE_TYPES = {
  sharpen:  { scale: 2, face_enhance: false },
  brighten: { scale: 2, face_enhance: false },
  upscale:  { scale: 4, face_enhance: false },
  portrait: { scale: 2, face_enhance: true  },
} as const;

type EnhanceType = keyof typeof ENHANCE_TYPES;

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (output && typeof (output as Record<string, unknown>)['url'] === 'function') {
    const result = (output as { url: () => string | URL }).url();
    return result instanceof URL ? result.toString() : String(result);
  }
  return String(output);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file     = formData.get('image') as File | null;
    const rawType  = formData.get('type') as string | null;
    const type: EnhanceType = (rawType && rawType in ENHANCE_TYPES)
      ? (rawType as EnhanceType)
      : 'sharpen';

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const bytes    = await file.arrayBuffer();
    const base64   = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl  = `data:${mimeType};base64,${base64}`;

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Missing API token' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: token });
    const params    = ENHANCE_TYPES[type];

    const output = await replicate.run(
      'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
      {
        input: {
          image:        dataUrl,
          scale:        params.scale,
          face_enhance: params.face_enhance,
        },
      },
    );

    const imageUrl = extractUrl(output);

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[enhance-image]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Enhancement failed' },
      { status: 500 },
    );
  }
}
