import { NextResponse } from 'next/server';
import { OPERATION_COSTS, RATE_LIMIT_TABLE, REEL_RATE_LIMIT } from '@/lib/pricing';
import { PLAN_CREDITS, STUDIO_CREDIT_PACKS, STUDIO_PLAN_PRICES_EUR, SUPERUSER_ONLY_PLANS } from '@/lib/constants';

// Public pricing info (no auth) — the same table every charge reads, for clients that can't import it
export function GET() {
  const plans = (Object.keys(STUDIO_PLAN_PRICES_EUR) as (keyof typeof STUDIO_PLAN_PRICES_EUR)[])
    .filter((id) => !SUPERUSER_ONLY_PLANS.has(id))
    .map((id) => ({ id, priceEur: STUDIO_PLAN_PRICES_EUR[id], monthly: PLAN_CREDITS[id] }));

  const rateLimits = Object.fromEntries(
    Object.entries(RATE_LIMIT_TABLE).map(([k, { free, starter, pro, unit }]) => [k, { free, starter, pro, unit }]),
  );

  return NextResponse.json(
    {
      operations: OPERATION_COSTS,
      plans,
      creditPacks: STUDIO_CREDIT_PACKS,
      rateLimits: { ...rateLimits, reel: REEL_RATE_LIMIT },
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
