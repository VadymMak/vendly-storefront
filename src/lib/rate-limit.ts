import { getOrCreateCredits, isSuperuser } from './credits';
import { FLAT_RATE_LIMITS, RATE_LIMIT_TABLE, RATE_LIMIT_WINDOW_MS, REEL_RATE_LIMIT, type RateLimitConfig as PlanLimits } from './pricing';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs:    number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= config.maxRequests;
}

/** Rate limit check with superuser bypass. Superusers skip rate limiting entirely. */
export async function checkRateLimitWithBypass(
  key: string,
  limit: RateLimitConfig,
  userId: string,
): Promise<boolean> {
  if (await isSuperuser(userId)) return true;
  return checkRateLimit(key, limit);
}

// Cleanup old entries every 60s to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// Per-route limits by plan — built from RATE_LIMIT_TABLE in src/lib/pricing.ts (edit numbers there)
function perPlan(cfg: PlanLimits) {
  const windowMs = RATE_LIMIT_WINDOW_MS[cfg.unit];
  return {
    free:         { maxRequests: cfg.free,         windowMs },
    starter:      { maxRequests: cfg.starter,      windowMs },
    pro:          { maxRequests: cfg.pro,          windowMs },
    byok_creator: { maxRequests: cfg.byok_creator, windowMs },
  };
}

const T = RATE_LIMIT_TABLE;
const flat = (l: { max: number; unit: PlanLimits['unit'] }) => ({ maxRequests: l.max, windowMs: RATE_LIMIT_WINDOW_MS[l.unit] });

export const RATE_LIMITS = {
  generateImage: perPlan(T.generateImage),
  generateVideo: perPlan(T.generateVideo),
  aiEdit:        perPlan(T.aiEdit),
  enhanceImage:  perPlan(T.enhanceImage),
  removeBg:      perPlan(T.removeBg),
  // Cheap local Sharp ops (format convert, resize) — limit protects CPU/RAM, not credits
  imageTools:    perPlan(T.imageTools),
  reel: {
    hourly: { maxRequests: REEL_RATE_LIMIT.hourly, windowMs: RATE_LIMIT_WINDOW_MS.hour },
    daily:  { maxRequests: REEL_RATE_LIMIT.daily,  windowMs: RATE_LIMIT_WINDOW_MS.day },
  },
  register:      flat(FLAT_RATE_LIMITS.register),
  buyCredits:    flat(FLAT_RATE_LIMITS.buyCredits),
  kbChat:        perPlan(T.kbChat),
  enhancePrompt: perPlan(T.enhancePrompt),
  studioChat:    perPlan(T.studioChat),
} as const;

type PlanBucket = { [K in keyof typeof RATE_LIMITS]: (typeof RATE_LIMITS)[K] extends { free: unknown } ? K : never }[keyof typeof RATE_LIMITS];

/** Per-plan limit of one bucket for this user (superusers bypass); `key` should be unique per route */
export async function checkPlanRateLimit(bucket: PlanBucket, key: string, userId: string): Promise<boolean> {
  const credits = await getOrCreateCredits(userId);
  const limits = RATE_LIMITS[bucket];
  const plan = (credits.planType || 'free') as keyof typeof limits;
  return checkRateLimitWithBypass(`${key}:${userId}`, limits[plan] ?? limits.free, userId);
}
