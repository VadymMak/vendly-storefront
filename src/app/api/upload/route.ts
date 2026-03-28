import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `shops/${session.user.id}/${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Nahrávanie zlyhalo' }, { status: 500 });
  }
}
