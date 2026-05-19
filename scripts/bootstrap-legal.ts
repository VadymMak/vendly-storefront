/**
 * One-time bootstrap: push legal component files to ALL 6 template repos.
 * Run: npx tsx scripts/bootstrap-legal.ts
 *
 * Reads source files from vendly-storefront/src/ and pushes them to the
 * correct paths (without src/ prefix) in every template repo using the
 * same GitHub Tree API pattern as sync-lib.ts.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
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

// Local source path → target path in template repos (src/ prefix stripped)
const FILE_MAP: Array<{ localPath: string; repoPath: string }> = [
  {
    localPath: 'src/components/legal/ImpressumPage.tsx',
    repoPath:  'components/legal/ImpressumPage.tsx',
  },
  {
    localPath: 'src/components/legal/DatenschutzPage.tsx',
    repoPath:  'components/legal/DatenschutzPage.tsx',
  },
  {
    localPath: 'src/components/ui/CookieConsentBanner.tsx',
    repoPath:  'components/ui/CookieConsentBanner.tsx',
  },
  {
    localPath: 'src/app/[locale]/impressum/page.tsx',
    repoPath:  'app/[locale]/impressum/page.tsx',
  },
  {
    localPath: 'src/app/[locale]/datenschutz/page.tsx',
    repoPath:  'app/[locale]/datenschutz/page.tsx',
  },
];

if (!TOKEN || !OWNER) {
  console.error('❌ GITHUB_TOKEN and GITHUB_OWNER must be set in .env.local');
  process.exit(1);
}

// ─── GitHub API helpers (same as sync-lib.ts) ─────────────────────────────────

async function ghFetch(apiPath: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${apiPath}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

async function ghJson<T>(apiPath: string, opts: RequestInit = {}): Promise<T> {
  const res = await ghFetch(apiPath, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} on ${apiPath}: ${body}`);
  }
  return res.json() as Promise<T>;
}

interface GhRef      { object: { sha: string } }
interface GhCommit   { tree: { sha: string } }
interface GhBlob     { sha: string }
interface GhTree     { sha: string }
interface GhNewCommit { sha: string }

async function createBlob(repo: string, content: string): Promise<string> {
  const blob = await ghJson<GhBlob>(`/repos/${OWNER}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  return blob.sha;
}

async function pushToRepo(
  repo: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  const ref        = await ghJson<GhRef>(`/repos/${OWNER}/${repo}/git/refs/heads/main`);
  const headSha    = ref.object.sha;
  const commit     = await ghJson<GhCommit>(`/repos/${OWNER}/${repo}/git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;

  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobSha = await createBlob(repo, file.content);
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blobSha });
  }

  const tree = await ghJson<GhTree>(`/repos/${OWNER}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });

  const newCommit = await ghJson<GhNewCommit>(`/repos/${OWNER}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat(legal): add German legal pages and CookieBanner',
      tree: tree.sha,
      parents: [headSha],
    }),
  });

  await ghJson(`/repos/${OWNER}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha.slice(0, 10);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load file contents from local filesystem
  const files = FILE_MAP.map(({ localPath, repoPath }) => {
    const absPath = path.resolve(process.cwd(), localPath);
    if (!fs.existsSync(absPath)) {
      console.error(`❌ Source file not found: ${localPath}`);
      process.exit(1);
    }
    return { path: repoPath, content: fs.readFileSync(absPath, 'utf-8') };
  });

  console.log(`\nBootstrapping legal pages to ${ALL_REPOS.length} template repos...\n`);
  console.log('Files to push:');
  files.forEach(f => console.log(`  ${f.path} (${f.content.length} chars)`));
  console.log('');

  for (const repo of ALL_REPOS) {
    process.stdout.write(`  ${repo}... `);
    try {
      const sha = await pushToRepo(repo, files);
      console.log(`✅ ${sha}`);
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
