import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ── In-memory rate limiter (per IP, 10 uploads/min) ───────────────────────────
const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now   = Date.now();
  const entry = rl.get(ip);
  if (!entry || now > entry.reset) {
    rl.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const filename = `leads/temp/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const blob = await put(filename, uploadBuffer, { access: 'public', contentType: 'image/webp' });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Lead photo upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
