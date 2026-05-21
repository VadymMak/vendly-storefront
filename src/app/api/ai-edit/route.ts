import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export const maxDuration = 60;

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output) && output.length > 0) return String(output[0]);
  if (output && typeof (output as Record<string, unknown>)['url'] === 'function') {
    const result = (output as { url: () => string | URL }).url();
    return result instanceof URL ? result.toString() : String(result);
  }
  return String(output);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keyRecord = await db.userApiKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'replicate' } },
  });
  if (!keyRecord) return NextResponse.json({ error: 'Replicate API key not configured' }, { status: 400 });

  const replicateKey = decrypt(keyRecord.encryptedKey);

  try {
    const formData = await req.formData();
    const file   = formData.get('image') as File | null;
    const prompt = formData.get('prompt') as string | null;

    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    if (!prompt?.trim()) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const ext   = file.type.split('/')[1] || 'jpg';

    const blob = await put(
      `studio/ai-edit/${session.user.id}/${Date.now()}.${ext}`,
      Buffer.from(bytes),
      { access: 'public', contentType: file.type || 'image/jpeg' },
    );

    const replicate = new Replicate({ auth: replicateKey });

    const output = await replicate.run(
      'timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f',
      {
        input: {
          image:                blob.url,
          prompt:               prompt.trim(),
          num_inference_steps:  50,
          image_guidance_scale: 1.5,
        },
      },
    );

    const imageUrl = extractUrl(output);
    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    console.error('[ai-edit]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI edit failed' },
      { status: 500 },
    );
  }
}
