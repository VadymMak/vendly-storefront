import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const fd   = await req.formData();
    const file = fd.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const buffer     = Buffer.from(await file.arrayBuffer());
    const webpBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': `attachment; filename="edited-${Date.now()}.webp"`,
      },
    });
  } catch (err) {
    console.error('[export-image]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    );
  }
}
