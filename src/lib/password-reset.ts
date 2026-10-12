import { createHash, randomBytes } from 'crypto';
import { db } from './db';

/** Raw token for the emailed link — never stored. */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the DB stores: a leaked table can't be turned back into working links. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── Session invalidation ──────────────────────────────────────────────────────
// JWT sessions issued before User.passwordChangedAt are rejected in the jwt callback.
// Cached in-process (single pm2 process) so auth() doesn't hit Neon (us-east-1) on
// every call; resetting a password updates the cache immediately.
const CACHE_TTL_MS = 5 * 60 * 1000;
const passwordChangedCache = new Map<string, { changedAt: number | null; fetchedAt: number }>();

export function notePasswordChanged(userId: string, changedAt: Date): void {
  passwordChangedCache.set(userId, { changedAt: changedAt.getTime(), fetchedAt: Date.now() });
}

/** ms timestamp of the last password change, null if never; undefined if the user no longer exists. */
export async function getPasswordChangedAt(userId: string): Promise<number | null | undefined> {
  const cached = passwordChangedCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.changedAt;

  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  if (!user) {
    passwordChangedCache.delete(userId);
    return undefined;
  }
  const changedAt = user.passwordChangedAt?.getTime() ?? null;
  if (passwordChangedCache.size > 10_000) passwordChangedCache.clear();
  passwordChangedCache.set(userId, { changedAt, fetchedAt: Date.now() });
  return changedAt;
}
