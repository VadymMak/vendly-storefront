/**
 * One-time: copy StudioJob images that still live on provider CDNs into Vercel Blob.
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/backfill-blob-urls.ts            # dry run
 *   npx tsx --env-file=.env --env-file=.env.local scripts/backfill-blob-urls.ts --apply    # write
 *
 * Images only (videos are skipped — persistToBlob only accepts image content types).
 * Expired URLs are left as they are. When a job's outputUrl changes, other jobs whose
 * metadata.sourceUrl pointed at the old URL are re-pointed, so My Work keeps hiding the
 * superseded steps it hid before.
 */
import { PrismaClient } from '@prisma/client';
import { persistToBlob } from '../src/lib/persist-to-blob';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const jobs = await db.studioJob.findMany({
    where: {
      status:    'succeeded',
      outputUrl: { not: null },
      type:      { not: 'video' },
      NOT:       { outputUrl: { contains: 'blob.vercel-storage.com' } },
    },
    select:  { id: true, outputUrl: true, type: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${jobs.length} image jobs with non-Blob URLs`);
  if (!APPLY) {
    const hosts = new Map<string, number>();
    for (const j of jobs) {
      const host = (() => { try { return new URL(j.outputUrl!).hostname; } catch { return 'invalid'; } })();
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
    }
    for (const [host, n] of [...hosts].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${host}`);
    console.log('Re-run with --apply to copy the ones that are still reachable.');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  for (const job of jobs) {
    const oldUrl = job.outputUrl!;
    const newUrl = await persistToBlob(oldUrl, `backfill/${job.type || 'legacy'}`);
    if (newUrl === oldUrl) {
      skipped++;
      console.log(`– ${job.id} expired / not an image / not allowed`);
    } else {
      await db.studioJob.update({ where: { id: job.id }, data: { outputUrl: newUrl } });
      await db.$executeRaw`
        UPDATE "StudioJob"
        SET metadata = jsonb_set(metadata::jsonb, '{sourceUrl}', to_jsonb(${newUrl}::text))
        WHERE metadata->>'sourceUrl' = ${oldUrl}`;
      migrated++;
      console.log(`✓ ${job.id}`);
    }
    await new Promise((r) => setTimeout(r, 200)); // don't hammer the CDNs
  }
  console.log(`\nDone: ${migrated} copied to Blob, ${skipped} left as they were`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
