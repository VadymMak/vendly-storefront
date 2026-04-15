import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import sharp from 'sharp';

const MAX_SIZE      = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMG   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_PDF   = ['application/pdf'];
const ALLOWED       = [...ALLOWED_IMG, ...ALLOWED_PDF];

// ── In-memory rate limiter (per IP, 20 uploads/min) ───────────────────────────
const rl = new Map<string, { count: number; reset: number }>();

function checkRate(ip: string): boolean {
  const now   = Date.now();
  const entry = rl.get(ip);
  if (!entry || now > entry.reset) {
    rl.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const formData = await request.formData();
  const file     = formData.get('file')   as File   | null;
  const leadId   = formData.get('leadId') as string | null;

  if (!file || !leadId) {
    return NextResponse.json({ error: 'Missing file or leadId' }, { status: 400 });
  }

  // Validate lead
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, briefSubmitted: true } });
  if (!lead || lead.briefSubmitted) {
    return NextResponse.json({ error: 'Invalid or expired brief link' }, { status: 403 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    let uploadBuffer: Buffer;
    let contentType: string;
    let ext: string;

    if (ALLOWED_PDF.includes(file.type)) {
      // PDFs go through as-is
      uploadBuffer = buffer;
      contentType  = 'application/pdf';
      ext          = 'pdf';
    } else {
      // Images → WebP 85
      uploadBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = 'image/webp';
      ext         = 'webp';
    }

    const filename = `briefs/${leadId}/${Date.now()}.${ext}`;
    const blob = await put(filename, uploadBuffer, { access: 'public', contentType });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Brief upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
