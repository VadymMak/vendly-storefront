// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileCommit {
  path: string;
  content: string;
}

interface GitRefResponse {
  object: { sha: string };
}

interface GitCommitResponse {
  tree: { sha: string };
}

interface GitBlobResponse {
  sha: string;
}

interface GitTreeResponse {
  sha: string;
}

interface GitNewCommitResponse {
  sha: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is missing');
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function githubFetch<T>(
  step: string,
  url: string,
  options: RequestInit,
): Promise<T> {
  const res = await fetch(url, { ...options, headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error at step "${step}": HTTP ${res.status} — ${body}`);
  }
  return res.json() as Promise<T>;
}

function toBase64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function commitFiles(
  repoName: string,
  files: FileCommit[],
): Promise<string> {
  const owner = process.env.GITHUB_OWNER;
  if (!owner) throw new Error('GITHUB_OWNER env var is missing');

  const base = `https://api.github.com/repos/${owner}/${repoName}`;

  // a) Get current HEAD of main
  const refData = await githubFetch<GitRefResponse>(
    'get ref heads/main',
    `${base}/git/ref/heads/main`,
    { method: 'GET' },
  );
  const parentCommitSha = refData.object.sha;

  // b) Get tree SHA of that commit
  const commitData = await githubFetch<GitCommitResponse>(
    'get parent commit',
    `${base}/git/commits/${parentCommitSha}`,
    { method: 'GET' },
  );
  const parentTreeSha = commitData.tree.sha;

  // c) Create a blob for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blobData = await githubFetch<GitBlobResponse>(
        `create blob for ${file.path}`,
        `${base}/git/blobs`,
        {
          method: 'POST',
          body: JSON.stringify({
            content:  toBase64(file.content),
            encoding: 'base64',
          }),
        },
      );
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha:  blobData.sha,
      };
    }),
  );

  // d) Create new tree
  const treeData = await githubFetch<GitTreeResponse>(
    'create tree',
    `${base}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parentTreeSha,
        tree:      treeItems,
      }),
    },
  );
  const newTreeSha = treeData.sha;

  // e) Create commit
  const newCommitData = await githubFetch<GitNewCommitResponse>(
    'create commit',
    `${base}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: `feat: customize site for ${repoName}`,
        tree:    newTreeSha,
        parents: [parentCommitSha],
      }),
    },
  );
  const newCommitSha = newCommitData.sha;

  // f) Update ref to point to new commit
  await githubFetch<unknown>(
    'update ref heads/main',
    `${base}/git/refs/heads/main`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha }),
    },
  );

  return newCommitSha;
}
