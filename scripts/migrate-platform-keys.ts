import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/lib/encryption';

const db = new PrismaClient();

const ENV_TO_PROVIDER: Array<{ envName: string; provider: string }> = [
  { envName: 'FAL_KEY',             provider: 'fal' },
  { envName: 'REPLICATE_API_TOKEN', provider: 'replicate' },
  { envName: 'XAI_API_KEY',         provider: 'xai' },
  { envName: 'BFL_API_KEY',         provider: 'bfl' },
  { envName: 'OPENAI_API_KEY',      provider: 'openai' },
  { envName: 'ANTHROPIC_API_KEY',   provider: 'anthropic' },
  { envName: 'KLING_API_KEY',       provider: 'kling_key' },
  { envName: 'KLING_API_SECRET',    provider: 'kling_secret' },
];

const PLATFORM_USER_ID = 'platform';

async function main() {
  console.log('🔑 Migrating platform keys from .env to database...\n');

  let migrated = 0;
  let skipped = 0;

  for (const { envName, provider } of ENV_TO_PROVIDER) {
    const value = process.env[envName];
    if (!value) {
      console.log(`  ⏭  ${envName} — not set, skipping`);
      skipped++;
      continue;
    }

    const encryptedKey = encrypt(value);
    const keyHint = value.length > 4 ? `...${value.slice(-4)}` : '****';

    await db.userApiKey.upsert({
      where: {
        userId_provider: { userId: PLATFORM_USER_ID, provider },
      },
      update: {
        encryptedKey,
        keyHint,
        isPlatform: true,
        isActive: true,
      },
      create: {
        userId: PLATFORM_USER_ID,
        provider,
        encryptedKey,
        keyHint,
        isPlatform: true,
        isActive: true,
      },
    });

    console.log(`  ✅ ${envName} → platform/${provider} (hint: ${keyHint})`);
    migrated++;
  }

  console.log(`\n✅ Done: ${migrated} migrated, ${skipped} skipped`);
}

main()
  .catch(e => { console.error('❌ Migration failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
