import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Povolené sú len obrázky (JPG, PNG, WEBP, GIF)' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Súbor je príliš veľký (max 5 MB)' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const purpose = formData.get('purpose') as string | null;
    const isBanner = purpose === 'banner';

    // Banner: 1920px, WebP 92 (premium quality for hero)
    // Other images: 1600px, WebP 85
    const webpBuffer = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF
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
