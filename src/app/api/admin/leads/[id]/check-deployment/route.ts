import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';

interface VercelDeployment {
  uid: string;
  state: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'INITIALIZING';
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const VERCEL_TOKEN   = process.env.VERCEL_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

  if (!VERCEL_TOKEN) {
    return NextResponse.json({ error: 'VERCEL_TOKEN not configured' }, { status: 500 });
  }

  const lead = await db.lead.findUnique({
    where: { id },
    select: { vercelProject: true, siteRepoName: true, siteStatus: true },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Already resolved — no need to poll Vercel
  if (
    lead.siteStatus === 'created'    ||
    lead.siteStatus === 'qa_passed'  ||
    lead.siteStatus === 'qa_failed'  ||
    lead.siteStatus === 'qa_pending'
  ) {
    return NextResponse.json({ status: 'ready', url: `https://${lead.siteRepoName}.vercel.app` });
  }

  // Project ID not saved yet — Vercel project creation may still be in flight
  if (!lead.vercelProject) {
    return NextResponse.json({ status: 'queued' });
  }

  const teamQuery = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : '';

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${lead.vercelProject}&limit=1${teamQuery}`,
      {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      // Don't fail the poll — Vercel may transiently 429 etc.
      return NextResponse.json({ status: 'queued', error: `Vercel API: ${res.status}` });
    }

    const data       = await res.json() as VercelDeploymentsResponse;
    const deployment = data.deployments?.[0];

    if (!deployment) {
      return NextResponse.json({ status: 'queued' });
    }

    const { state, uid } = deployment;

    if (state === 'READY') {
      await db.lead.update({
        where: { id },
        data:  { siteStatus: 'created' },
      });
      return NextResponse.json({
        status: 'ready',
        url: `https://${lead.siteRepoName}.vercel.app`,
      });
    }

    if (state === 'ERROR' || state === 'CANCELED') {
      await db.lead.update({
        where: { id },
        data:  { siteStatus: 'error', siteError: `Vercel deployment ${state.toLowerCase()}` },
      });
      return NextResponse.json({ status: 'error', deploymentId: uid });
    }

    if (state === 'BUILDING') {
      return NextResponse.json({ status: 'building' });
    }

    // QUEUED or INITIALIZING
    return NextResponse.json({ status: 'queued' });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ status: 'queued', error: message });
  }
}
