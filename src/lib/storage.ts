import { mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { dirname, extname, resolve, sep } from 'path';
import { randomUUID } from 'crypto';

/**
 * Server-local file storage — drop-in replacement for @vercel/blob put()/del().
 *
 * Files live under UPLOAD_DIR (outside the app dir, so they survive git pull / builds) and are
 * served at UPLOAD_BASE_URL by src/app/uploads/[...path]/route.ts. Public HTTPS for
 * vendshop.shop is a Cloudflare tunnel straight to Next.js, so no nginx is involved.
 *
 * Rollback: STORAGE_BACKEND=blob in .env (+ restart) sends writes to Vercel Blob again.
 */

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || '/home/vadym/uploads');
export const UPLOAD_BASE_URL = (process.env.UPLOAD_BASE_URL || 'https://vendshop.shop/uploads').replace(/\/+$/, '');
const USE_VERCEL_BLOB = process.env.STORAGE_BACKEND === 'blob';

export interface StorageResult {
  url: string;
  pathname: string;
}

export interface PutOptions {
  access?: string;
  contentType?: string;
  multipart?: boolean;
  addRandomSuffix?: boolean;
  token?: string;
}

type PutBody = Buffer | Uint8Array | ArrayBuffer | Blob | string;

/** Absolute path for a stored pathname; throws if it would escape UPLOAD_DIR. */
export function resolveUploadPath(pathname: string): string {
  const clean = pathname.replace(/^\/+/, '');
  const full = resolve(UPLOAD_DIR, clean);
  if (!full.startsWith(UPLOAD_DIR + sep)) throw new Error(`invalid storage path: ${pathname}`);
  return full;
}

/** Pathname for one of our own upload URLs, or null for anything else. */
export function localPathnameFromUrl(url: string): string | null {
  if (!url.startsWith(UPLOAD_BASE_URL + '/')) return null;
  return decodeURIComponent(url.slice(UPLOAD_BASE_URL.length + 1).split(/[?#]/)[0]);
}

async function toBuffer(body: PutBody): Promise<Buffer> {
  if (typeof body === 'string') return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  return Buffer.from(await body.arrayBuffer());
}

/** Save a file; same call shape and { url } result as @vercel/blob put(). Options are ignored locally. */
export async function put(pathname: string, body: PutBody, options?: PutOptions): Promise<StorageResult> {
  if (USE_VERCEL_BLOB) {
    const blob = await import('@vercel/blob');
    const r = await blob.put(pathname, await toBuffer(body), {
      access: 'public',
      contentType: options?.contentType,
      multipart: options?.multipart,
    });
    return { url: r.url, pathname: r.pathname };
  }

  const fullPath = resolveUploadPath(pathname);
  await mkdir(dirname(fullPath), { recursive: true });
  // Write to a temp file and rename, so a half-written file is never served
  const tmp = `${fullPath}.${randomUUID()}.tmp`;
  await writeFile(tmp, await toBuffer(body));
  await rename(tmp, fullPath);

  const clean = fullPath.slice(UPLOAD_DIR.length + 1).split(sep).join('/');
  return { url: `${UPLOAD_BASE_URL}/${clean.split('/').map(encodeURIComponent).join('/')}`, pathname: clean };
}

/** Delete one or more files (URLs or pathnames). Missing files are fine. */
export async function del(target: string | string[]): Promise<void> {
  const items = Array.isArray(target) ? target : [target];
  const blobUrls: string[] = [];

  for (const item of items) {
    const pathname = localPathnameFromUrl(item) ?? (item.startsWith('http') ? null : item);
    if (pathname === null) {
      // Pre-migration Vercel Blob URLs — delete there while the store still exists
      if (item.includes('.blob.vercel-storage.com/')) blobUrls.push(item);
      else console.warn(`[storage.del] skipping foreign URL: ${item}`);
      continue;
    }
    try {
      await unlink(resolveUploadPath(pathname));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  if (blobUrls.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await import('@vercel/blob');
    await blob.del(blobUrls);
  }
}

/** Read one of our stored files from disk (server-side, no network round trip). */
export async function readLocalUpload(url: string, maxBytes: number): Promise<{ buffer: Buffer; ext: string } | null> {
  const pathname = localPathnameFromUrl(url);
  if (pathname === null) return null;
  const fullPath = resolveUploadPath(pathname);
  const info = await stat(fullPath);
  if (info.size > maxBytes) throw new Error('file too large');
  return { buffer: await readFile(fullPath), ext: extname(fullPath).slice(1).toLowerCase() };
}
