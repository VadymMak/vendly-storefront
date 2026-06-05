import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

type ExportFormat = 'png' | 'jpeg' | 'webp';

const MIME: Record<ExportFormat, string> = {
  png:  'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function toFormat(raw: string | null | undefined): ExportFormat {
  return (raw === 'png' || raw === 'jpeg' || raw === 'webp') ? raw : 'webp';
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let imageBuffer: Buffer;
    let format: ExportFormat;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      // JSON path: server-side fetch of external CDN URL (avoids browser CORS)
      const body = await req.json() as { url?: string; format?: string };
      if (!body.url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

      format = toFormat(body.format);

      const imgRes = await fetch(body.url);
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch image from CDN' }, { status: 502 });
      }
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      // FormData path: blob uploaded directly by client (existing callers)
      const fd     = await req.formData();
      const file   = fd.get('image') as File | null;
      format = toFormat(fd.get('format') as string | null);

      if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
      imageBuffer = Buffer.from(await file.arrayBuffer());
    }

    const input = sharp(imageBuffer);

    let outBuffer: Buffer;
    if (format === 'png')       outBuffer = await input.png().toBuffer();
    else if (format === 'jpeg') outBuffer = await input.jpeg({ quality: 92 }).toBuffer();
    else                        outBuffer = await input.webp({ quality: 90 }).toBuffer();

    return new NextResponse(new Uint8Array(outBuffer), {
      headers: {
        'Content-Type':        MIME[format],
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
