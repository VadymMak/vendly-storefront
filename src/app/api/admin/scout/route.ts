import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin-auth';

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR_ID   = 'compass~crawler-google-places';

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
  const maxResults = Math.min(Math.max(body.maxResults ?? 25, 10), 200);

  if (!query || !city) {
    return Response.json({ error: 'query and city are required' }, { status: 400 });
  }

  const startRes = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray:        [`${query} ${city}`],
        maxCrawledPlacesPerSearch: maxResults,
        language:                  'sk',
        countryCode:               'sk',
      }),
    },
  );

  if (!startRes.ok) {
    const status = startRes.status;
    const text   = await startRes.text();

    if (status === 402) {
      return Response.json(
        { error: 'Apify credits exhausted. Please top up your Apify account.' },
        { status: 402 },
      );
    }

    return Response.json({ error: `Apify start failed (${status}): ${text}` }, { status: 502 });
  }

  const { data: run } = await startRes.json() as { data: { id: string; status: string } };
  return Response.json({ runId: run.id, status: run.status });
}
