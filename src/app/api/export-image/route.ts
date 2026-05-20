import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

type ExportFormat = 'png' | 'jpeg' | 'webp';

const MIME: Record<ExportFormat, string> = {
  png:  'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const fd     = await req.formData();
    const file   = fd.get('image') as File | null;
    const rawFmt = fd.get('format') as string | null;
    const format: ExportFormat = (rawFmt === 'png' || rawFmt === 'jpeg' || rawFmt === 'webp') ? rawFmt : 'webp';

    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const input = sharp(Buffer.from(await file.arrayBuffer()));

    let outBuffer: Buffer;
    if (format === 'png')  outBuffer = await input.png().toBuffer();
    else if (format === 'jpeg') outBuffer = await input.jpeg({ quality: 92 }).toBuffer();
    else outBuffer = await input.webp({ quality: 90 }).toBuffer();

    return new NextResponse(new Uint8Array(outBuffer), {
      headers: {
        'Content-Type': MIME[format],
        'Content-Disposition': `attachment; filename="edited-${Date.now()}.${format}"`,
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
