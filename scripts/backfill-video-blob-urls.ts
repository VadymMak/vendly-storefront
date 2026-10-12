/**
 * One-time: copy finished video StudioJobs from provider CDNs into Vercel Blob.
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/backfill-video-blob-urls.ts            # dry run (HEAD check)
 *   npx tsx --env-file=.env --env-file=.env.local scripts/backfill-video-blob-urls.ts --apply    # copy + update
 *
 * Expired URLs are left as they are; videos are streamed (never fully in memory).
 */
import { PrismaClient } from '@prisma/client';
import { persistVideoToBlob } from '../src/lib/persist-to-blob';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const jobs = await db.studioJob.findMany({
    where: {
      type:      'video',
      status:    'succeeded',
      outputUrl: { not: null },
      NOT:       { outputUrl: { contains: 'blob.vercel-storage.com' } },
    },
    select:  { id: true, outputUrl: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${jobs.length} video jobs with non-Blob URLs`);

  let ok = 0;
  let dead = 0;
  for (const job of jobs) {
    const oldUrl = job.outputUrl!;

    if (!APPLY) {
      const res = await fetch(oldUrl, { method: 'HEAD', redirect: 'manual' }).catch(() => null);
      const size = res?.headers.get('content-length');
      if (res?.ok) ok++; else dead++;
      console.log(`${res?.ok ? 'alive' : 'dead '} ${res?.status ?? 'ERR'} ${size ? `${(Number(size) / 1048576).toFixed(1)} MB` : ''} ${job.id}`);
      continue;
    }

    const newUrl = await persistVideoToBlob(oldUrl, 'backfill/video');
    if (newUrl === oldUrl) {
      dead++;
      console.log(`– ${job.id} expired / fetch failed`);
    } else {
      await db.studioJob.updateMany({ where: { id: job.id, outputUrl: oldUrl }, data: { outputUrl: newUrl } });
      ok++;
      console.log(`✓ ${job.id}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${ok} ${APPLY ? 'copied to Blob' : 'alive'}, ${dead} ${APPLY ? 'left as they were' : 'dead'}`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
