import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { resultUrl?: string; originalWidth?: number; originalHeight?: number };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { resultUrl, originalWidth, originalHeight } = body;

  if (!resultUrl || !originalWidth || !originalHeight) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const res = await fetch(resultUrl);
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }

  const inputBuffer = Buffer.from(await res.arrayBuffer());

  const resized = await sharp(inputBuffer)
    .resize(originalWidth, originalHeight, {
      fit: 'fill',
      kernel: 'lanczos3',
    })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const blob = await put(
    `studio/resize/${session.user.id}/${Date.now()}.jpg`,
    resized,
    { access: 'public', contentType: 'image/jpeg' },
  );

  return NextResponse.json({ url: blob.url });
}
