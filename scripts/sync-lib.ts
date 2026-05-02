/**
 * Syncs shared directories from vendshop-template-classic to all other template repos.
 * Run: npx ts-node scripts/sync-lib.ts
 *
 * SYNC_DIRS lists every directory whose contents must stay byte-identical across
 * the 6 template repos. HeroSection.tsx is the deliberate exception (3 visual variants),
 * but everything else in components/sections/ and components/widgets/ is shared infra.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = process.env.GITHUB_OWNER!;
const SOURCE = 'vendshop-template-classic';
const TARGETS = [
  'vendshop-template-warm',
  'vendshop-template-dark',
  'vendshop-template-bold',
  'vendshop-template-natural',
  'vendshop-template-medical',
];

const SYNC_DIRS = [
  'lib',
  'components/sections',
  'components/widgets',
];

// Files we must NOT overwrite — visual variants per template.
const SKIP_PATHS = new Set<string>([
  'components/sections/HeroSection.tsx',
  'components/sections/HeroSection.module.css',
]);

if (!TOKEN || !OWNER) {
  console.error('❌ GITHUB_TOKEN and GITHUB_OWNER must be set in .env.local');
  process.exit(1);
}

async function ghFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = `https://api.github.com${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

async function ghJson<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await ghFetch(path, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

interface GhFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  download_url: string | null;
}

interface GhRef {
  object: { sha: string };
}

interface GhCommit {
  tree: { sha: string };
}

interface GhBlob {
  sha: string;
}

interface GhTree {
  sha: string;
}

interface GhNewCommit {
  sha: string;
}

async function getDirFiles(repo: string, dir: string): Promise<GhFile[]> {
  const items = await ghJson<GhFile[]>(`/repos/${OWNER}/${repo}/contents/${dir}`);
  return items.filter(f => f.type === 'file' && !SKIP_PATHS.has(f.path));
}

async function getFileContent(file: GhFile): Promise<string> {
  const res = await fetch(file.download_url!);
  if (!res.ok) throw new Error(`Failed to download ${file.path}: ${res.status}`);
  return res.text();
}

async function createBlob(repo: string, content: string): Promise<string> {
  const blob = await ghJson<GhBlob>(`/repos/${OWNER}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  return blob.sha;
}

async function syncToRepo(
  repo: string,
  files: Array<{ path: string; content: string }>
): Promise<string> {
  // Get current HEAD sha
  const ref = await ghJson<GhRef>(`/repos/${OWNER}/${repo}/git/refs/heads/main`);
  const headSha = ref.object.sha;

  // Get base tree sha
  const commit = await ghJson<GhCommit>(`/repos/${OWNER}/${repo}/git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;

  // Create blobs for each file
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobSha = await createBlob(repo, file.content);
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  // Create new tree
  const tree = await ghJson<GhTree>(`/repos/${OWNER}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });

  // Create commit
  const newCommit = await ghJson<GhNewCommit>(`/repos/${OWNER}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `sync: update ${SYNC_DIRS.join(', ')} from classic`,
      tree: tree.sha,
      parents: [headSha],
    }),
  });

  // Update ref
  await ghJson(`/repos/${OWNER}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha.slice(0, 10);
}

async function main() {
  console.log(`\nReading ${SYNC_DIRS.join(', ')} from ${SOURCE}...\n`);

  const allFiles: GhFile[] = [];
  for (const dir of SYNC_DIRS) {
    const files = await getDirFiles(SOURCE, dir);
    console.log(`  ${dir}: ${files.length} file(s) — ${files.map(f => f.name).join(', ')}`);
    allFiles.push(...files);
  }
  console.log(`\nTotal: ${allFiles.length} files to sync\n`);

  const fileContents = await Promise.all(
    allFiles.map(async f => ({
      path: f.path,
      content: await getFileContent(f),
    }))
  );

  for (const target of TARGETS) {
    process.stdout.write(`  ${target}... `);
    try {
      const sha = await syncToRepo(target, fileContents);
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
