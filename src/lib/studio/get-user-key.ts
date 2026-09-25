import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

/**
 * Server-only helper — returns the decrypted API key for a user+provider pair.
 * Never expose this through an HTTP route; import directly in server-side code.
 */
export async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  const record = await db.userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { encryptedKey: true },
  });
  if (!record) return null;
  return decrypt(record.encryptedKey);
}
