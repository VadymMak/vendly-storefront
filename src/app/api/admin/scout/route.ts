import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';

interface ApifyRunData {
  data: { id: string; status: string };
}

interface ApifyStatusData {
  data: { status: string };
}

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID   = 'compass~crawler-google-places';
const MAX_POLLS  = 30; // 30 × 3s = 90s max wait

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return Response.json({ error: 'APIFY_API_TOKEN is not configured' }, { status: 500 });
  }

  const body = await req.json() as { query?: string; city?: string; maxResults?: number };
  const query      = (body.query ?? '').trim();
  const city       = (body.city  ?? '').trim();
  const maxResults = Math.min(Math.max(body.maxResults ?? 50, 10), 200);

  if (!query || !city) {
    return Response.json({ error: 'query and city are required' }, { status: 400 });
  }

  // Start Apify run
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray:         [`${query} ${city}`],
        maxCrawledPlacesPerSearch:  maxResults,
        language:                   'sk',
        countryCode:                'sk',
      }),
    },
  );

  if (!startRes.ok) {
    const text = await startRes.text();
    return Response.json({ error: `Apify start failed: ${text}` }, { status: 502 });
  }

  const { data: run } = await startRes.json() as ApifyRunData;
  const runId = run.id;

  // Poll until SUCCEEDED or FAILED (every 3s)
  let status = run.status;
  let polls  = 0;

  while (['RUNNING', 'READY', 'CREATED'].includes(status) && polls < MAX_POLLS) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes  = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json() as ApifyStatusData;
    status = statusData.data.status;
    polls++;
  }

  if (status !== 'SUCCEEDED') {
    return Response.json(
      { error: `Apify run did not complete (status: ${status}, polls: ${polls})` },
      { status: 502 },
    );
  }

  // Fetch dataset items
  const dataRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=${maxResults}`,
  );

  if (!dataRes.ok) {
    return Response.json({ error: 'Failed to fetch Apify results' }, { status: 502 });
  }

  const results = await dataRes.json() as unknown[];
  return Response.json({ results });
}
