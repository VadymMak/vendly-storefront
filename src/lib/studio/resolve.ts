import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import type { ModelEntry } from './config';

/**
 * Resolve the API key for a model entry.
 * Priority: user's BYOK key → platform env var (only for non-byokOnly models)
 */
export async function resolveApiKey(
  userId: string,
  model: ModelEntry,
): Promise<string | null> {
  const userKey = await db.userApiKey.findUnique({
    where: { userId_provider: { userId, provider: model.apiKeyProvider } },
    select: { encryptedKey: true },
  });
  if (userKey?.encryptedKey) {
    return decrypt(userKey.encryptedKey);
  }

  if (!model.byokOnly && model.envKeyName) {
    return process.env[model.envKeyName] ?? null;
  }

  return null;
}
