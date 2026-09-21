/**
 * Creates a sentinel "platform" User record required for the UserApiKey
 * relation when platform keys (userId = "platform") are stored.
 *
 * Run once after fresh DB setup:
 *   npx tsx scripts/create-platform-user.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const existing = await db.user.findUnique({ where: { id: 'platform' } });

  if (existing) {
    console.log('✅ Platform sentinel user already exists — nothing to do.');
    return;
  }

  await db.user.create({
    data: {
      id:           'platform',
      email:        'platform@internal.vendshop.local',
      passwordHash: null,
      name:         'Platform (system)',
    },
  });

  console.log('✅ Platform sentinel user created (id="platform").');
}

main()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
