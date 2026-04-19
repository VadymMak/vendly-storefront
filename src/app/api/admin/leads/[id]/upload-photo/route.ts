import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import sharp from 'sharp';

const MAX_SIZE    = 10 * 1024 * 1024;
const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const lead = await db.lead.findUnique({ where: { id }, select: { id: true, photoUrls: true } });
  if (!lead) {
    return NextResponse.json({ error: 'Лид не найден' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
  }
  if (!ALLOWED_IMG.includes(file.type)) {
    return NextResponse.json({ error: 'Неподдерживаемый тип файла' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const webpBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `briefs/${id}/admin-${Date.now()}.webp`;
    const blob = await put(filename, webpBuffer, { access: 'public', contentType: 'image/webp' });

    const existing: string[] = [];
    if (lead.photoUrls) {
      try {
        const parsed = JSON.parse(lead.photoUrls) as unknown;
        if (Array.isArray(parsed)) existing.push(...(parsed as string[]));
      } catch { /* ignore */ }
    }
    existing.push(blob.url);
    const newPhotoUrls = JSON.stringify(existing);

    await db.lead.update({ where: { id }, data: { photoUrls: newPhotoUrls } });

    console.log(`[admin upload-photo] Загружено для лида ${id}: ${blob.url}`);
    return NextResponse.json({ url: blob.url, photoUrls: newPhotoUrls });
  } catch (err) {
    console.error('[admin upload-photo] Ошибка:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 });
  }
}
