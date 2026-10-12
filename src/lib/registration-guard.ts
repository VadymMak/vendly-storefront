import { createHmac } from 'crypto';
import { db } from './db';
import { REGISTRATION_LIMITS } from './constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Real client IP. Behind the Cloudflare tunnel cf-connecting-ip is set by Cloudflare and can't be spoofed. */
export function getClientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
}

/** Keyed hash — raw IPs are never stored (GDPR). */
export function hashIp(ip: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET ?? '').update(ip).digest('hex');
}

/** True when this IP hash already created perIpPerDay accounts in the last 24h. Fails open on DB errors. */
export async function isRegistrationLimited(ipHash: string): Promise<boolean> {
  try {
    const count = await db.registrationAttempt.count({
      where: { ipHash, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    return count >= REGISTRATION_LIMITS.perIpPerDay;
  } catch (err) {
    console.error('[registration-guard] count failed — allowing sign-up:', err);
    return false;
  }
}

/** Record a successful sign-up and purge rows past the retention window. */
export async function recordRegistration(ipHash: string): Promise<void> {
  await db.registrationAttempt.create({ data: { ipHash } });
  await db.registrationAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - REGISTRATION_LIMITS.ipRetentionDays * DAY_MS) } },
  });
}
