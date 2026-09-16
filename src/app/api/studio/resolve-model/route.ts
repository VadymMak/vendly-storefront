import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TIER_ROUTES, MODEL_CATALOG, type ModelTier } from '@/lib/studio/config';
import { resolveApiKey } from '@/lib/studio/resolve';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { tier?: ModelTier };
  const tier = body.tier;
  if (!tier || !TIER_ROUTES[tier]) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const routes = TIER_ROUTES[tier];

  for (const route of routes) {
    const model = MODEL_CATALOG[route.alias];
    if (!model || !model.enabled) continue;
    const apiKey = await resolveApiKey(session.user.id, model);
    if (apiKey) {
      return NextResponse.json({
        alias:       route.alias,
        tier:        model.tier,
        creditCost:  model.creditCost,
        displayName: model.displayName,
        provider:    model.provider,
      });
    }
  }

  const fallback = MODEL_CATALOG[routes[0].alias];
  return NextResponse.json({
    alias:       routes[0].alias,
    tier:        fallback?.tier ?? tier,
    creditCost:  fallback?.creditCost ?? 1,
    displayName: fallback?.displayName ?? 'Unknown',
    provider:    fallback?.provider ?? 'unknown',
  });
}
