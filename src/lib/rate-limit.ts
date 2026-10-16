import { isSuperuser } from './credits';

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

// Per-route limits by plan (requests per hour unless noted)
export const RATE_LIMITS = {
  generateImage: {
    free:         { maxRequests: 5,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 80,  windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  },
  generateVideo: {
    free:         { maxRequests: 1,  windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 3,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 10, windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 50, windowMs: 60 * 60 * 1000 },
  },
  aiEdit: {
    free:         { maxRequests: 5,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 80,  windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  },
  enhanceImage: {
    free:         { maxRequests: 5,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 80,  windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  },
  removeBg: {
    free:         { maxRequests: 5,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 80,  windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  },
  // Cheap local Sharp ops (format convert, resize) — limit protects CPU/RAM, not credits
  imageTools: {
    free:         { maxRequests: 60,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 200,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 400,  windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 1000, windowMs: 60 * 60 * 1000 },
  },
  // Per user, all plans — credits are the real cap, this stops bursts against FAL/Kling
  reel: {
    hourly: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
    daily:  { maxRequests: 30, windowMs: 24 * 60 * 60 * 1000 },
  },
  register:   { maxRequests: 2, windowMs: 24 * 60 * 60 * 1000 },
  buyCredits: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  // Help bot — gpt-4o on the platform key, no credit cost, so the hourly cap is the only brake
  kbChat: {
    free:         { maxRequests: 3,  windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 20, windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 50, windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 50, windowMs: 60 * 60 * 1000 },
  },
  // Prompt enhancer — Claude on the platform key (users' own key only on the video-skill path)
  enhancePrompt: {
    free:         { maxRequests: 5,  windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 20, windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 50, windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 50, windowMs: 60 * 60 * 1000 },
  },
  // Studio chat agent — each message runs the agent model; its tools charge credits separately
  studioChat: {
    free:         { maxRequests: 5,   windowMs: 60 * 60 * 1000 },
    starter:      { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
    pro:          { maxRequests: 100, windowMs: 60 * 60 * 1000 },
    byok_creator: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  },
} as const;
