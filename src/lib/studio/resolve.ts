import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import type { ModelEntry } from './config';

export type KeySource = 'byok' | 'platform' | 'env';

export interface ResolvedKey {
  key: string;
  source: KeySource;
}

/**
 * Resolve the API key for a model entry.
 * Priority:
 *   1. User's own BYOK key (UserApiKey where userId = real user)
 *   2. Platform key from DB (UserApiKey where userId = "platform", isPlatform = true)
 *   3. .env fallback (temporary — will be removed after migration is verified)
 */
export async function resolveApiKey(
  userId: string,
  model: ModelEntry,
): Promise<string | null> {
  const resolved = await resolveApiKeyWithSource(userId, model);
  return resolved?.key ?? null;
}

export async function resolveApiKeyWithSource(
  userId: string,
  model: ModelEntry,
): Promise<ResolvedKey | null> {
  // 1. Check user's own BYOK key
  const userKey = await db.userApiKey.findUnique({
    where: { userId_provider: { userId, provider: model.apiKeyProvider } },
    select: { encryptedKey: true, isActive: true },
  });
  if (userKey?.encryptedKey && userKey.isActive !== false) {
    return { key: decrypt(userKey.encryptedKey), source: 'byok' };
  }

  // 2. Check platform key in DB (byokOnly models skip this)
  if (!model.byokOnly) {
    const platformKey = await db.userApiKey.findFirst({
      where: {
        userId: 'platform',
        provider: model.apiKeyProvider,
        isPlatform: true,
        isActive: true,
      },
      select: { encryptedKey: true, id: true },
    });
    if (platformKey?.encryptedKey) {
      // Update lastUsedAt (fire-and-forget, don't block the request)
      db.userApiKey.update({
        where: { id: platformKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      return { key: decrypt(platformKey.encryptedKey), source: 'platform' };
    }
  }

  // 3. .env fallback (TEMPORARY — remove after platform keys are verified in DB)
  if (!model.byokOnly && model.envKeyName) {
    const envKey = process.env[model.envKeyName];
    if (envKey) {
      return { key: envKey, source: 'env' };
    }
  }

  return null;
}
