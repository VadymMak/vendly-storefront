import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only image, video and audio files allowed' }, { status: 400 });
    }

    const maxSize = file.type.startsWith('video/')
      ? 100 * 1024 * 1024
      : file.type.startsWith('audio/')
        ? 20 * 1024 * 1024
        : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const limit = file.type.startsWith('video/') ? '100MB' : file.type.startsWith('audio/') ? '20MB' : '10MB';
      return NextResponse.json({ error: `File must be under ${limit}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let finalBuffer = buffer;
    let contentType = file.type;
    let ext: string;

    if (file.type.startsWith('image/')) {
      // Resize large phone photos to max 1536px and convert to webp
      finalBuffer = Buffer.from(await sharp(buffer)
        .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer());
      contentType = 'image/webp';
      ext = 'webp';
    } else if (file.type.startsWith('video/')) {
      ext = file.name.split('.').pop() || 'mp4';
    } else {
      ext = file.name.split('.').pop() || 'mp3';
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blob = await put(
      `studio/chat/upload/${session.user.id}/${uniqueId}.${ext}`,
      finalBuffer,
      { access: 'public', contentType },
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[studio/upload]', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
