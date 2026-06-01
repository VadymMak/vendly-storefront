/**
 * Add Google Reviews button to ReviewsSection.tsx in all 6 template repos.
 * Also patches lib/types.ts (add googleReviewsUrl to SiteConfig) and
 * lib/config.ts (add empty default field).
 *
 * Run: npx tsx scripts/fix-reviews-google.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER!;

const ALL_REPOS = [
  'vendshop-template-classic',
  'vendshop-template-warm',
  'vendshop-template-dark',
  'vendshop-template-bold',
  'vendshop-template-natural',
  'vendshop-template-medical',
];

const COMMIT_MSG = 'feat(reviews): add Google reviews button when no reviews';

if (!TOKEN || !OWNER) {
  console.error('❌ GITHUB_TOKEN and GITHUB_OWNER must be set in .env.local');
  process.exit(1);
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function gh<T>(apiPath: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} on ${apiPath}: ${body}`);
  }
  return res.json() as Promise<T>;
}

interface GhContents  { content: string }
interface GhRef       { object: { sha: string } }
interface GhCommit    { tree: { sha: string } }
interface GhBlob      { sha: string }
interface GhTree      { sha: string }
interface GhNewCommit { sha: string }

async function getFileContent(repo: string, filePath: string): Promise<string> {
  const data = await gh<GhContents>(`/repos/${OWNER}/${repo}/contents/${filePath}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function createBlob(repo: string, content: string): Promise<string> {
  const blob = await gh<GhBlob>(`/repos/${OWNER}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  return blob.sha;
}

async function pushFiles(
  repo: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  const ref         = await gh<GhRef>(`/repos/${OWNER}/${repo}/git/refs/heads/main`);
  const headSha     = ref.object.sha;
  const commit      = await gh<GhCommit>(`/repos/${OWNER}/${repo}/git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;

  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobSha = await createBlob(repo, file.content);
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blobSha });
  }

  const tree = await gh<GhTree>(`/repos/${OWNER}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });

  const newCommit = await gh<GhNewCommit>(`/repos/${OWNER}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: COMMIT_MSG, tree: tree.sha, parents: [headSha] }),
  });

  await gh(`/repos/${OWNER}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha.slice(0, 10);
}

// ─── Patch functions ──────────────────────────────────────────────────────────

function patchTypes(original: string): string {
  const ANCHOR      = '  contactEmail: string;';
  const REPLACEMENT = '  contactEmail: string;\n  googleReviewsUrl: string;';
  if (original.includes('googleReviewsUrl')) return original; // already patched
  return original.replace(ANCHOR, REPLACEMENT);
}

function patchConfig(original: string): string {
  const ANCHOR      = "  contactEmail: '',\n};";
  const REPLACEMENT = "  contactEmail: '',\n  googleReviewsUrl: '',\n};";
  if (original.includes('googleReviewsUrl')) return original; // already patched
  return original.replace(ANCHOR, REPLACEMENT);
}

function patchReviewsSection(original: string): string {
  if (original.includes('googleReviewsUrl')) return original; // already patched

  // 1. Add SITE_CONFIG import after the t() import
  const IMPORT_ANCHOR = "import { t } from '@/lib/get-ui-text';";
  const IMPORT_ADD    = "import { SITE_CONFIG } from '@/lib/config';";
  let patched = original.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${IMPORT_ADD}`);

  // 2. Insert Google Reviews block before the closing </div> of "container"
  const GRID_CLOSE    = '        </div>\n      </div>\n    </section>';
  const GOOGLE_BLOCK  = [
    '        </div>',
    '',
    '        {REVIEWS.length === 0 && SITE_CONFIG.googleReviewsUrl && (',
    '          <ScrollReveal>',
    '            <div className={styles.googleReviews}>',
    '              <p>Pozrite si naše recenzie</p>',
    '              <a',
    '                href={SITE_CONFIG.googleReviewsUrl}',
    '                target="_blank"',
    '                rel="noopener noreferrer"',
    '                className="btn btn--primary"',
    '              >',
    '                Zobraziť recenzie na Google ★',
    '              </a>',
    '            </div>',
    '          </ScrollReveal>',
    '        )}',
    '      </div>',
    '    </section>',
  ].join('\n');

  patched = patched.replace(GRID_CLOSE, GOOGLE_BLOCK);
  return patched;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPatching ${ALL_REPOS.length} template repos...\n`);

  for (const repo of ALL_REPOS) {
    process.stdout.write(`  ${repo}... `);
    try {
      const [typesOrig, configOrig, reviewsOrig] = await Promise.all([
        getFileContent(repo, 'lib/types.ts'),
        getFileContent(repo, 'lib/config.ts'),
        getFileContent(repo, 'components/sections/ReviewsSection.tsx'),
      ]);

      const typesPatched   = patchTypes(typesOrig);
      const configPatched  = patchConfig(configOrig);
      const reviewsPatched = patchReviewsSection(reviewsOrig);

      const alreadyDone =
        typesPatched   === typesOrig   &&
        configPatched  === configOrig  &&
        reviewsPatched === reviewsOrig;

      if (alreadyDone) {
        console.log('⏭  already patched, skipped');
        continue;
      }

      const filesToPush: Array<{ path: string; content: string }> = [];
      if (typesPatched   !== typesOrig)   filesToPush.push({ path: 'lib/types.ts',                                content: typesPatched   });
      if (configPatched  !== configOrig)  filesToPush.push({ path: 'lib/config.ts',                               content: configPatched  });
      if (reviewsPatched !== reviewsOrig) filesToPush.push({ path: 'components/sections/ReviewsSection.tsx',      content: reviewsPatched });

      const sha = await pushFiles(repo, filesToPush);
      console.log(`✅ ${sha} (${filesToPush.map(f => f.path.split('/').pop()).join(', ')})`);
    } catch (err) {
      console.log(`❌ ${(err as Error).message}`);
    }
  }

  console.log('\nDone.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
