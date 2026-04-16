import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GitHub API response types
interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}

// Vercel API response types
interface VercelProjectResponse {
  id: string;
  name: string;
  alias?: { domain: string }[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

function buildRepoName(businessName: string | null, businessType: string): string {
  const base = slugify(businessName ?? 'site');
  const type = slugify(businessType);
  return `${base}-${type}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Validate required env vars
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER;
  const GITHUB_TEMPLATE_REPO = process.env.GITHUB_TEMPLATE_REPO;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

  const missingVars = [
    !GITHUB_TOKEN && 'GITHUB_TOKEN',
    !GITHUB_OWNER && 'GITHUB_OWNER',
    !GITHUB_TEMPLATE_REPO && 'GITHUB_TEMPLATE_REPO',
    !VERCEL_TOKEN && 'VERCEL_TOKEN',
  ].filter(Boolean);

  if (missingVars.length > 0) {
    return NextResponse.json(
      { error: `Missing required env vars: ${missingVars.join(', ')}` },
      { status: 500 }
    );
  }

  // 1. Find lead
  const lead = await db.lead.findUnique({ where: { id } });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // 2. Guard: already in progress or done
  if (lead.siteStatus !== 'none' && lead.siteStatus !== 'error') {
    return NextResponse.json(
      { error: 'Site already creating or created' },
      { status: 400 }
    );
  }

  // 3. Mark as creating
  await db.lead.update({
    where: { id },
    data: { siteStatus: 'creating' },
  });

  let repoName = buildRepoName(lead.businessName, lead.businessType);

  try {
    // 4. Create GitHub repo from template
    const githubRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_TEMPLATE_REPO}/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: GITHUB_OWNER,
          name: repoName,
          private: false,
        }),
      }
    );

    // Handle name collision: 422 Unprocessable Entity
    if (githubRes.status === 422) {
      repoName = `${repoName}-${randomSuffix()}`;

      const retryRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_TEMPLATE_REPO}/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            owner: GITHUB_OWNER,
            name: repoName,
            private: false,
          }),
        }
      );

      if (!retryRes.ok) {
        const errBody = await retryRes.text();
        throw new Error(`GitHub API error (retry): ${retryRes.status} — ${errBody}`);
      }

      const _retryData: GitHubRepoResponse = await retryRes.json();
      void _retryData;
    } else if (!githubRes.ok) {
      const errBody = await githubRes.text();
      throw new Error(`GitHub API error: ${githubRes.status} — ${errBody}`);
    } else {
      const _githubData: GitHubRepoResponse = await githubRes.json();
      void _githubData;
    }

    // 5. Wait for GitHub to finish generating from template
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));

    // 6. Create Vercel project with GitHub integration
    const vercelRes = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        framework: 'nextjs',
        gitRepository: {
          type: 'github',
          repo: `${GITHUB_OWNER}/${repoName}`,
        },
      }),
    });

    if (!vercelRes.ok) {
      const errBody = await vercelRes.text();
      throw new Error(`Vercel API error: ${vercelRes.status} — ${errBody}`);
    }

    const _vercelData: VercelProjectResponse = await vercelRes.json();
    void _vercelData;

    const repoUrl = `https://github.com/${GITHUB_OWNER}/${repoName}`;
    const vercelUrl = `https://${repoName}.vercel.app`;

    // 7. Update lead
    await db.lead.update({
      where: { id },
      data: {
        siteRepoUrl: repoUrl,
        siteRepoName: repoName,
        siteVercelUrl: vercelUrl,
        siteStatus: 'created',
        siteCreatedAt: new Date(),
        siteError: null,
      },
    });

    // 8. Return success
    return NextResponse.json({ success: true, repoUrl, vercelUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 9. On error — update lead and return 500
    await db.lead.update({
      where: { id },
      data: {
        siteStatus: 'error',
        siteError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
