/**
 * One-time: re-encode existing upscale / SUPIR PNG results in Vercel Blob as WebP
 * (same dimensions; JPEG for sides over 16383 px, which WebP can't encode).
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/compress-upscale-blobs.ts            # dry run
 *   npx tsx --env-file=.env --env-file=.env.local scripts/compress-upscale-blobs.ts --apply    # write
 *
 * Order per file: upload WebP → update StudioJob.outputUrl (and any metadata.sourceUrl that
 * pointed at the PNG, so My Work keeps hiding superseded steps) → delete the PNG.
 */
import { PrismaClient } from '@prisma/client';
import { del, put } from '@vercel/blob';
import sharp from 'sharp';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

async function main() {
  const jobs = await db.studioJob.findMany({
    where: {
      status: 'succeeded',
      outputUrl: { contains: 'blob.vercel-storage.com' },
      OR: [{ outputUrl: { contains: '/studio/upscale/' } }, { outputUrl: { contains: '/studio/supir/' } }],
    },
    select: { id: true, outputUrl: true },
  });
  const pngJobs = jobs.filter((j) => j.outputUrl!.endsWith('.png'));
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${pngJobs.length} upscale/SUPIR PNG results`);

  let before = 0, after = 0, done = 0, failed = 0;
  for (const job of pngJobs) {
    const url = job.outputUrl!;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const png = Buffer.from(await res.arrayBuffer());
      const { width = 0, height = 0 } = await sharp(png).metadata();
      const isSupir = url.includes('/studio/supir/');
      const quality = isSupir ? 92 : 90;
      const tooWide = width > 16383 || height > 16383;
      const out = tooWide
        ? await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer()
        : await sharp(png).webp({ quality, effort: 4 }).toBuffer();
      before += png.length; after += out.length;
      console.log(`${job.id}  ${width}x${height}  ${mb(png.length)} → ${mb(out.length)} ${tooWide ? '(jpeg)' : '(webp)'}`);
      if (!APPLY) { done++; continue; }

      const path = `${isSupir ? 'studio/supir' : 'studio/upscale'}/backfill/${Date.now()}.${tooWide ? 'jpg' : 'webp'}`;
      const blob = await put(path, out, { access: 'public', contentType: tooWide ? 'image/jpeg' : 'image/webp' });
      await db.studioJob.update({ where: { id: job.id }, data: { outputUrl: blob.url } });
      await db.$executeRaw`
        UPDATE "StudioJob"
        SET metadata = jsonb_set(metadata::jsonb, '{sourceUrl}', to_jsonb(${blob.url}::text))
        WHERE metadata->>'sourceUrl' = ${url}`;
      await del(url);
      done++;
    } catch (err) {
      failed++;
      console.error(`${job.id}  failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nDone: ${done} ${APPLY ? 'converted' : 'would convert'}, ${failed} failed — ${mb(before)} → ${mb(after)} (saves ${mb(before - after)})`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
