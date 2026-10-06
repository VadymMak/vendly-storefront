import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperuser } from '@/lib/credits';
import { MAX_INPUT_PIXELS } from '@/lib/studio/safe-fetch';

// Superuser-only: drop the exact image bytes into a server folder the reel-lab Mac pulls from (scp over Tailscale)
const REEL_EXPORT_DIR = process.env.REEL_EXPORT_DIR ?? '/home/vadym/reel-test';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EXT_BY_FORMAT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const NUMBERED_FILE = /^(\d+)\.(jpg|png|webp)$/;

type ExportMode = 'auto' | 'replace' | 'new';

async function numberedFiles(): Promise<string[]> {
  return (await fs.readdir(REEL_EXPORT_DIR)).filter((f) => NUMBERED_FILE.test(f));
}

async function nextFilename(ext: string): Promise<string> {
  const numbers = (await numberedFiles()).map((f) => parseInt(f, 10));
  return `${(numbers.length ? Math.max(...numbers) : 0) + 1}.${ext}`;
}

async function requireSuperuser(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.id && (await isSuperuser(session.user.id));
}

export async function POST(req: Request) {
  if (!(await requireSuperuser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let file: File | null;
  let mode: ExportMode;
  let target: string | null;
  try {
    const form = await req.formData();
    file = form.get('image') as File | null;
    const rawMode = form.get('mode');
    mode = rawMode === 'replace' || rawMode === 'new' ? rawMode : 'auto';
    target = form.get('target') as string | null;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Sniff the real format — the bytes are stored untouched (no resize / re-encode)
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return NextResponse.json({ error: 'Not a valid image' }, { status: 400 });
  }
  const ext = meta.format ? EXT_BY_FORMAT[meta.format] : undefined;
  if (!ext) return NextResponse.json({ error: 'Only JPEG, PNG or WebP' }, { status: 400 });

  try {
    await fs.mkdir(REEL_EXPORT_DIR, { recursive: true });

    // Overwrite an existing export — target must be one of our numbered files with the same format
    if (mode === 'replace') {
      if (!target || !NUMBERED_FILE.test(target) || !(await numberedFiles()).includes(target)) {
        return NextResponse.json({ error: 'Unknown target file' }, { status: 400 });
      }
      if (!target.endsWith(`.${ext}`)) {
        return NextResponse.json({ error: 'Target has a different format' }, { status: 400 });
      }
      await fs.writeFile(path.join(REEL_EXPORT_DIR, target), buffer);
      return NextResponse.json({ success: true, replaced: true, filename: target, size: buffer.length });
    }

    // Same bytes already exported → let the user choose (replace / save as new) instead of piling up copies
    if (mode === 'auto') {
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      for (const name of await numberedFiles()) {
        const filePath = path.join(REEL_EXPORT_DIR, name);
        if ((await fs.stat(filePath)).size !== buffer.length) continue;
        if (crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex') === hash) {
          return NextResponse.json({ success: false, duplicate: true, existingName: name, nextName: await nextFilename(ext) });
        }
      }
    }

    // Sequential 1.jpg, 2.png, … — 'wx' fails on a name taken by a concurrent export, so retry with the next number
    for (let attempt = 0; attempt < 5; attempt++) {
      const filename = await nextFilename(ext);
      try {
        await fs.writeFile(path.join(REEL_EXPORT_DIR, filename), buffer, { flag: 'wx' });
        return NextResponse.json({
          success: true,
          filename,
          size:   buffer.length,
          width:  meta.width ?? null,
          height: meta.height ?? null,
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      }
    }
    throw new Error('Could not allocate a file number');
  } catch (err) {
    console.error('[export-reel]', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// List exported files
export async function GET() {
  if (!(await requireSuperuser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const names = await numberedFiles();
    const files = await Promise.all(names.map(async (name) => {
      const stat = await fs.stat(path.join(REEL_EXPORT_DIR, name));
      return { name, size: stat.size, modified: stat.mtime.toISOString() };
    }));
    files.sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
