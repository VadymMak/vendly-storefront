/**
 * One-time: copy every Vercel Blob file into UPLOAD_DIR (same pathname) and rewrite stored URLs
 * from the Blob store host to UPLOAD_BASE_URL. NOT run automatically.
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/migrate-blob-to-local.ts            # dry run
 *   npx tsx --env-file=.env --env-file=.env.local scripts/migrate-blob-to-local.ts --apply    # copy + rewrite
 *
 * Re-runnable: files already on disk with the right size are skipped. URLs in the database are
 * only rewritten when every file was copied, so a partial run never leaves dangling links.
 * Blob files are NOT deleted — the store stays as a fallback until it's switched off by hand.
 */
import { PrismaClient } from '@prisma/client';
import { list } from '@vercel/blob';
import { mkdir, rename, stat, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { resolveUploadPath, UPLOAD_BASE_URL, UPLOAD_DIR } from '../src/lib/storage';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

interface BlobFile { url: string; pathname: string; size: number }

async function listAll(): Promise<BlobFile[]> {
  const out: BlobFile[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    out.push(...page.blobs.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function onDisk(pathname: string, size: number): Promise<boolean> {
  try {
    return (await stat(resolveUploadPath(pathname))).size === size;
  } catch {
    return false;
  }
}

async function copy(file: BlobFile): Promise<void> {
  const res = await fetch(file.url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== file.size) throw new Error(`size mismatch ${buf.length} ≠ ${file.size}`);
  const fullPath = resolveUploadPath(file.pathname);
  await mkdir(dirname(fullPath), { recursive: true });
  const tmp = `${fullPath}.${randomUUID()}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, fullPath);
}

/** Every text/varchar/json/jsonb column in the public schema. */
async function textColumns(): Promise<{ table: string; column: string; type: string }[]> {
  return db.$queryRaw`
    SELECT table_name AS "table", column_name AS "column", data_type AS "type"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'json', 'jsonb')
      AND table_name NOT LIKE '\\_prisma%'`;
}

async function rewriteUrls(fromPrefix: string, toPrefix: string): Promise<number> {
  let total = 0;
  for (const { table, column, type } of await textColumns()) {
    const col = `"${column.replace(/"/g, '""')}"`;
    const tbl = `"${table.replace(/"/g, '""')}"`;
    const asText = type === 'json' || type === 'jsonb' ? `${col}::text` : col;
    const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM ${tbl} WHERE ${asText} LIKE '%' || $1 || '%'`, fromPrefix);
    if (Number(n) === 0) continue;
    console.log(`  ${table}.${column}: ${n} rows`);
    total += Number(n);
    if (!APPLY) continue;
    const replaced = `replace(${asText}, $1, $2)`;
    const value = type === 'json' || type === 'jsonb' ? `(${replaced})::${type}` : replaced;
    await db.$executeRawUnsafe(
      `UPDATE ${tbl} SET ${col} = ${value} WHERE ${asText} LIKE '%' || $1 || '%'`, fromPrefix, toPrefix);
  }
  return total;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — Vercel Blob → ${UPLOAD_DIR} (${UPLOAD_BASE_URL})`);

  const files = await listAll();
  const hosts = [...new Set(files.map((f) => new URL(f.url).origin))];
  console.log(`${files.length} blobs, ${mb(files.reduce((s, f) => s + f.size, 0))}, store: ${hosts.join(', ')}`);

  let copied = 0, skipped = 0, failed = 0, bytes = 0;
  for (const [i, file] of files.entries()) {
    if (await onDisk(file.pathname, file.size)) { skipped++; continue; }
    if (!APPLY) { copied++; bytes += file.size; continue; }
    try {
      await copy(file);
      copied++; bytes += file.size;
      console.log(`[${i + 1}/${files.length}] ${file.pathname} (${mb(file.size)})`);
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${files.length}] ${file.pathname} failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nFiles: ${copied} ${APPLY ? 'copied' : 'to copy'} (${mb(bytes)}), ${skipped} already on disk, ${failed} failed`);

  if (failed > 0) {
    console.log('Some copies failed — database URLs left untouched. Re-run to retry.');
    process.exitCode = 1;
    return;
  }

  console.log(`\nDatabase URLs ${APPLY ? 'rewritten' : 'to rewrite'}:`);
  let rows = 0;
  for (const host of hosts) rows += await rewriteUrls(`${host}/`, `${UPLOAD_BASE_URL}/`);
  console.log(`Total: ${rows} rows`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
