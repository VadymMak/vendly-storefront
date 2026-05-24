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
    free:    { maxRequests: 5,  windowMs: 60 * 60 * 1000 },
    starter: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
    pro:     { maxRequests: 80, windowMs: 60 * 60 * 1000 },
  },
  generateVideo: {
    free:    { maxRequests: 1,  windowMs: 60 * 60 * 1000 },
    starter: { maxRequests: 3,  windowMs: 60 * 60 * 1000 },
    pro:     { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  },
  aiEdit: {
    free:    { maxRequests: 5,  windowMs: 60 * 60 * 1000 },
    starter: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
    pro:     { maxRequests: 80, windowMs: 60 * 60 * 1000 },
  },
  enhanceImage: {
    free:    { maxRequests: 5,  windowMs: 60 * 60 * 1000 },
    starter: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
    pro:     { maxRequests: 80, windowMs: 60 * 60 * 1000 },
  },
  removeBg: {
    free:    { maxRequests: 5,  windowMs: 60 * 60 * 1000 },
    starter: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
    pro:     { maxRequests: 80, windowMs: 60 * 60 * 1000 },
  },
  register:   { maxRequests: 2, windowMs: 24 * 60 * 60 * 1000 },
  buyCredits: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
} as const;
