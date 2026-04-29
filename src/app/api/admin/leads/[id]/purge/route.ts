import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

// ─── Response shape ───────────────────────────────────────────────────────────

type StepResult = 'deleted' | 'skipped' | `error: ${string}`;

interface PurgeResult {
  success: boolean;
  deleted: {
    github: StepResult;
    vercel: StepResult;
    blobs:  { total: number; deleted: number; errors: string[] };
    lead:   'deleted';
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VERCEL_BLOB_HOST_FRAGMENT = '.public.blob.vercel-storage.com';

function isVercelBlobUrl(url: string): boolean {
  return url.includes(VERCEL_BLOB_HOST_FRAGMENT);
}

/** Pull every photo URL we know about off a lead, dedup, and keep only Vercel-Blob URLs. */
function collectBlobUrls(lead: {
  heroPhotoUrl: string | null;
  galleryUrls:  string[];
  photoUrls:    string | null;
  logoUrl:      string | null;
}): string[] {
  const urls: string[] = [];

  if (lead.heroPhotoUrl) urls.push(lead.heroPhotoUrl);
  if (lead.logoUrl)      urls.push(lead.logoUrl);
  if (Array.isArray(lead.galleryUrls)) urls.push(...lead.galleryUrls);

  // photoUrls is a JSON string: ["url1","url2","url3"]
  if (lead.photoUrls) {
    try {
      const parsed = JSON.parse(lead.photoUrls) as unknown;
      if (Array.isArray(parsed)) {
        for (const u of parsed) {
          if (typeof u === 'string' && u.trim()) urls.push(u.trim());
        }
      }
    } catch {
      // Bad JSON — silently skip; non-fatal
    }
  }

  // Dedup, drop falsy, keep only Vercel Blob hosts
  return Array.from(new Set(urls.filter(Boolean))).filter(isVercelBlobUrl);
}

function errResult(err: unknown): `error: ${string}` {
  const msg = err instanceof Error ? err.message : String(err);
  return `error: ${msg}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<PurgeResult | { error: string }>> {
  // ── Auth: admin only ───────────────────────────────────────────────────────
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  // ── Step A — Load Lead ─────────────────────────────────────────────────────
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  let github: StepResult = 'skipped';
  let vercel: StepResult = 'skipped';
  const blobErrors: string[] = [];
  let blobDeleted = 0;
  const blobUrls = collectBlobUrls(lead);

  // ── Step B — Delete GitHub repo ────────────────────────────────────────────
  // Same identifiers + auth pattern as create-site/route.ts (raw fetch, not Octokit —
  // Octokit isn't a project dependency).
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER;

  if (!lead.siteRepoName) {
    console.log('[purge-lead] Step B: no repo to delete');
  } else if (!GITHUB_TOKEN || !GITHUB_OWNER) {
    github = 'error: GITHUB_TOKEN or GITHUB_OWNER not configured';
    console.error('[purge-lead] Step B:', github);
  } else {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${lead.siteRepoName}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept:        'application/vnd.github+json',
          },
        },
      );

      if (res.status === 204) {
        github = 'deleted';
        console.log('[purge-lead] Step B: GitHub repo deleted —', lead.siteRepoName);
      } else if (res.status === 404) {
        github = 'deleted'; // already gone — treat as success
        console.log('[purge-lead] Step B: GitHub repo already absent —', lead.siteRepoName);
      } else {
        const body = await res.text().catch(() => '');
        github = `error: HTTP ${res.status} — ${body.slice(0, 200)}`;
        console.error('[purge-lead] Step B failed:', github);
      }
    } catch (err) {
      github = errResult(err);
      console.error('[purge-lead] Step B exception:', err);
    }
  }

  // ── Step C — Delete Vercel project (cascades all deployments) ──────────────
  const VERCEL_TOKEN   = process.env.VERCEL_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

  // Vercel project name === GitHub repo name (see create-site/route.ts:396)
  const vercelProjectName = lead.siteRepoName;

  if (!vercelProjectName) {
    console.log('[purge-lead] Step C: no Vercel project to delete');
  } else if (!VERCEL_TOKEN) {
    vercel = 'error: VERCEL_TOKEN not configured';
    console.error('[purge-lead] Step C:', vercel);
  } else {
    try {
      const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
      const res = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectName}${teamQuery}`,
        {
          method:  'DELETE',
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        },
      );

      if (res.status === 204 || res.ok) {
        vercel = 'deleted';
        console.log('[purge-lead] Step C: Vercel project deleted —', vercelProjectName);
      } else if (res.status === 404) {
        vercel = 'deleted'; // already gone
        console.log('[purge-lead] Step C: Vercel project already absent —', vercelProjectName);
      } else {
        const body = await res.text().catch(() => '');
        vercel = `error: HTTP ${res.status} — ${body.slice(0, 200)}`;
        console.error('[purge-lead] Step C failed:', vercel);
      }
    } catch (err) {
      vercel = errResult(err);
      console.error('[purge-lead] Step C exception:', err);
    }
  }

  // ── Step D — Delete Vercel Blob photos ─────────────────────────────────────
  // Only attempt URLs that look like Vercel Blob — Unsplash etc. are silently dropped
  // by collectBlobUrls.
  for (const url of blobUrls) {
    try {
      await del(url);
      blobDeleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      blobErrors.push(`${url}: ${msg}`);
      console.error('[purge-lead] Step D blob delete failed:', url, msg);
    }
  }
  console.log(
    `[purge-lead] Step D: blobs deleted ${blobDeleted}/${blobUrls.length}` +
    (blobErrors.length ? ` (${blobErrors.length} errors)` : ''),
  );

  // ── Step E — Delete Lead row (DB is the source of truth) ───────────────────
  // If this fails, return 500 — the external resources may already be gone but the
  // lead row remains, which Vadym needs to know about.
  try {
    await db.lead.delete({ where: { id } });
    console.log('[purge-lead] Step E: lead row deleted —', id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[purge-lead] Step E failed:', msg);
    return NextResponse.json(
      { error: `Lead row delete failed: ${msg}` },
      { status: 500 },
    );
  }

  const result: PurgeResult = {
    success: true,
    deleted: {
      github,
      vercel,
      blobs: { total: blobUrls.length, deleted: blobDeleted, errors: blobErrors },
      lead:  'deleted',
    },
  };

  return NextResponse.json(result);
}
