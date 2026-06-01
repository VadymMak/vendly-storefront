/**
 * One-time fix: replace stub handleSubmit in BookingSection.tsx with
 * WhatsApp redirect in all 6 template repos.
 * Run: npx tsx scripts/fix-booking-whatsapp.ts
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

const REPO_PATH = 'components/sections/BookingSection.tsx';

const IMPORT_ANCHOR = "import { t } from '@/lib/get-ui-text';";
const IMPORT_TO_ADD = "import { SITE_CONFIG } from '@/lib/config';";

const STUB = [
  '  const handleSubmit = (e: React.FormEvent) => {',
  '    e.preventDefault();',
  '    // Replace with your API call or email service',
  '    setSubmitted(true);',
  '  };',
].join('\n');

const REPLACEMENT = [
  '  const handleSubmit = (e: React.FormEvent) => {',
  '    e.preventDefault();',
  '    const phone = SITE_CONFIG.whatsappNumber;',
  '    const text = encodeURIComponent(',
  '      `Rezervácia / Booking:\\n` +',
  '      `Meno: ${form.name}\\n` +',
  '      `Telefón: ${form.phone}\\n` +',
  '      `Služba: ${form.service}\\n` +',
  '      `Dátum: ${form.date}\\n` +',
  '      `Správa: ${form.message}`',
  '    );',
  "    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');",
  '    setSubmitted(true);',
  '  };',
].join('\n');

if (!TOKEN || !OWNER) {
  console.error('❌ GITHUB_TOKEN and GITHUB_OWNER must be set in .env.local');
  process.exit(1);
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

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

interface GhContents  { content: string; encoding: string }
interface GhRef       { object: { sha: string } }
interface GhCommit    { tree: { sha: string } }
interface GhBlob      { sha: string }
interface GhTree      { sha: string }
interface GhNewCommit { sha: string }

async function getFileContent(repo: string): Promise<string> {
  const data = await ghJson<GhContents>(`/repos/${OWNER}/${repo}/contents/${REPO_PATH}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function createBlob(repo: string, content: string): Promise<string> {
  const blob = await ghJson<GhBlob>(`/repos/${OWNER}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  return blob.sha;
}

async function pushToRepo(repo: string, content: string): Promise<string> {
  const ref         = await ghJson<GhRef>(`/repos/${OWNER}/${repo}/git/refs/heads/main`);
  const headSha     = ref.object.sha;
  const commit      = await ghJson<GhCommit>(`/repos/${OWNER}/${repo}/git/commits/${headSha}`);
  const baseTreeSha = commit.tree.sha;

  const blobSha = await createBlob(repo, content);

  const tree = await ghJson<GhTree>(`/repos/${OWNER}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path: REPO_PATH, mode: '100644', type: 'blob', sha: blobSha }],
    }),
  });

  const newCommit = await ghJson<GhNewCommit>(`/repos/${OWNER}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat(booking): wire form to WhatsApp redirect',
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

// ─── Patch logic ─────────────────────────────────────────────────────────────

function patchContent(original: string, repo: string): string {
  let patched = original;

  // 1. Add SITE_CONFIG import (only if missing)
  if (!patched.includes(IMPORT_TO_ADD)) {
    if (patched.includes(IMPORT_ANCHOR)) {
      patched = patched.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${IMPORT_TO_ADD}`);
    } else {
      // Fallback: insert before styles import
      const fallback = "import styles from './BookingSection.module.css';";
      if (patched.includes(fallback)) {
        patched = patched.replace(fallback, `${IMPORT_TO_ADD}\n${fallback}`);
      } else {
        console.warn(`  ⚠️  ${repo}: could not find import anchor — SITE_CONFIG import not added`);
      }
    }
  }

  // 2. Replace stub handleSubmit
  if (patched.includes(STUB)) {
    patched = patched.replace(STUB, REPLACEMENT);
  } else if (!patched.includes('wa.me')) {
    console.warn(`  ⚠️  ${repo}: stub not found and no wa.me present — handleSubmit not patched`);
  }

  return patched;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPatching BookingSection.tsx in ${ALL_REPOS.length} template repos...\n`);

  for (const repo of ALL_REPOS) {
    process.stdout.write(`  ${repo}... `);
    try {
      const original = await getFileContent(repo);
      const patched  = patchContent(original, repo);

      if (patched === original) {
        console.log('⏭  already patched, skipped');
        continue;
      }

      const sha = await pushToRepo(repo, patched);
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
