import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sharp from 'sharp';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { imageUrl?: string; format?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imageUrl, format } = body;

  if (!imageUrl || !['png', 'jpg', 'webp'].includes(format ?? '')) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }

  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const pipeline = sharp(inputBuffer);

  let buffer: Buffer;
  let contentType: string;
  let ext: string;

  switch (format) {
    case 'jpg':
      buffer = await pipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
      contentType = 'image/jpeg';
      ext = 'jpg';
      break;
    case 'webp':
      buffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
      break;
    case 'png':
    default:
      buffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      contentType = 'image/png';
      ext = 'png';
      break;
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="vendshop-studio.${ext}"`,
      'Content-Length': buffer.length.toString(),
    },
  });
}
