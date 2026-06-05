import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { isRawFile, convertRawToImage } from '@/lib/image-pipeline/raw-converter';

const MAX_SIZE_STANDARD = 5 * 1024 * 1024;  // 5 MB for JPEG/PNG/WEBP/GIF
const MAX_SIZE_RAW       = 50 * 1024 * 1024; // 50 MB for RAW camera files
const ALLOWED_STANDARD = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Neautorizovaný' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Žiadny súbor' }, { status: 400 });
  }

  const fileName = file.name ?? 'upload';
  const isRaw    = isRawFile(file.type, fileName);

  if (!isRaw && !ALLOWED_STANDARD.has(file.type)) {
    return NextResponse.json(
      { error: 'Povolené sú len obrázky (JPG, PNG, WEBP, GIF, CR2, NEF, ARW, DNG, …)' },
      { status: 400 },
    );
  }

  const maxSize = isRaw ? MAX_SIZE_RAW : MAX_SIZE_STANDARD;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `Súbor je príliš veľký (max ${isRaw ? '50' : '5'} MB)` },
      { status: 400 },
    );
  }

  try {
    let buffer: Buffer = Buffer.from(await file.arrayBuffer() as ArrayBuffer);
    const purpose  = formData.get('purpose') as string | null;
    const isBanner = purpose === 'banner';

    // RAW camera files: convert to PNG first, then continue with normal Sharp pipeline
    if (isRaw) {
      const result = await convertRawToImage(buffer, fileName);
      buffer = result.buffer;
      console.log(`[upload] RAW converted: ${result.originalFormat} ${result.width}×${result.height} ${result.bitDepth}-bit`);
    }

    // Banner: 1920px, WebP 92 (premium quality for hero)
    // Other images: 1600px, WebP 85
    const webpBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: isBanner ? 1920 : 1600, withoutEnlargement: true })
      .webp({ quality: isBanner ? 92 : 85 })
      .toBuffer();

    const filename = `shops/${session.user.id}/${Date.now()}.webp`;

    const blob = await put(filename, webpBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Nahrávanie zlyhalo' }, { status: 500 });
  }
}
