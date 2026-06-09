import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';

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

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Only image and video files allowed' }, { status: 400 });
    }
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File must be under ${file.type.startsWith('video/') ? '100MB' : '10MB'}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.includes('mp4') ? 'mp4'
      : file.type.includes('webm') ? 'webm'
      : file.type.includes('png') ? 'png'
      : file.type.includes('webp') ? 'webp'
      : 'jpg';

    const blob = await put(
      `studio/chat/upload/${session.user.id}/${Date.now()}.${ext}`,
      buffer,
      { access: 'public', contentType: file.type },
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[studio/upload]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
