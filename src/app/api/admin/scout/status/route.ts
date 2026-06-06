import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';

const APIFY_BASE = 'https://api.apify.com/v2';

interface ApifyRunData {
  data: {
    status: string;
    stats?: { itemCount?: number };
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return Response.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  if (!runId) {
    return Response.json({ error: 'runId is required' }, { status: 400 });
  }

  const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
  if (!statusRes.ok) {
    return Response.json({ error: 'Failed to check run status' }, { status: 502 });
  }

  const { data } = await statusRes.json() as ApifyRunData;
  const { status, stats } = data;
  const itemCount = stats?.itemCount ?? 0;

  if (['RUNNING', 'READY', 'CREATED'].includes(status)) {
    return Response.json({ status: 'running', itemCount });
  }

  if (status !== 'SUCCEEDED') {
    return Response.json({ status: 'failed', error: `Run ended with status: ${status}` });
  }

  const dataRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=200`,
  );

  if (!dataRes.ok) {
    return Response.json({ error: 'Failed to fetch results' }, { status: 502 });
  }

  const results = await dataRes.json() as unknown[];
  return Response.json({ status: 'succeeded', results });
}
