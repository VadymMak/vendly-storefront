import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { heicToJpegIfNeeded } from '@/lib/studio/heic';

// Phone cameras/galleries sometimes hand over JPEGs with a truncated tail. Browsers render them fine,
// but sharp's default failOn:'warning' rejects them ("premature end of JPEG image") — decode what's there.
const SHARP_INPUT = { failOn: 'none' } as const;

// Long-side cap for the working copy every studio consumer loads
const DISPLAY_MAX_SIDE = 1536;

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

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());

    let finalBuffer = buffer;
    let contentType = file.type;
    let ext: string;
    // Full-resolution copy (reel pipeline macro crops) — only when the working copy was downscaled
    let originalBuffer: Buffer | null = null;
    let originalExt = '';
    let originalContentType = '';

    if (file.type.startsWith('image/')) {
      buffer = await heicToJpegIfNeeded(buffer);
      const metadata = await sharp(buffer, SHARP_INPUT).metadata();
      const isPngWithAlpha = metadata.hasAlpha && (file.type === 'image/png' || file.name?.endsWith('.png'));
      const isOversized = (metadata.width ?? 0) > DISPLAY_MAX_SIDE || (metadata.height ?? 0) > DISPLAY_MAX_SIDE;

      if (isPngWithAlpha) {
        // Preserve alpha channel — keep as PNG (WebP lossy can degrade transparency edges)
        finalBuffer = Buffer.from(await sharp(buffer, SHARP_INPUT)
          .resize(DISPLAY_MAX_SIDE, DISPLAY_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 8 })
          .toBuffer());
        contentType = 'image/png';
        ext = 'png';
        if (isOversized) {
          originalBuffer = Buffer.from(await sharp(buffer, SHARP_INPUT).png({ compressionLevel: 8 }).toBuffer());
          originalContentType = 'image/png';
          originalExt = 'png';
        }
      } else {
        // Non-transparent images → WebP (smaller, faster)
        finalBuffer = Buffer.from(await sharp(buffer, SHARP_INPUT)
          .resize(DISPLAY_MAX_SIDE, DISPLAY_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 88 })
          .toBuffer());
        contentType = 'image/webp';
        ext = 'webp';
        if (isOversized) {
          // Re-encode rather than store the raw upload — strips EXIF (GPS) from the public blob
          originalBuffer = Buffer.from(await sharp(buffer, SHARP_INPUT)
            .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
            .toBuffer());
          originalContentType = 'image/jpeg';
          originalExt = 'jpg';
        }
      }
    } else if (file.type.startsWith('video/')) {
      ext = file.name.split('.').pop() || 'mp4';
    } else {
      ext = file.name.split('.').pop() || 'mp3';
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const basePath = `studio/chat/upload/${session.user.id}/${uniqueId}`;
    const [blob, originalBlob] = await Promise.all([
      put(`${basePath}.${ext}`, finalBuffer, { access: 'public', contentType }),
      originalBuffer
        ? put(`${basePath}-original.${originalExt}`, originalBuffer, { access: 'public', contentType: originalContentType })
        : null,
    ]);

    return NextResponse.json({ url: blob.url, originalUrl: originalBlob?.url ?? blob.url });
  } catch (error) {
    console.error('[studio/upload]', error);
    const message = error instanceof Error ? error.message : String(error);
    if (/unsupported image format|Input buffer|heif/i.test(message)) {
      return NextResponse.json(
        { error: 'Unsupported image format. Please use JPEG, PNG, or WebP.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
