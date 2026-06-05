# Prompt: Studio Backend Health Check & Neon DB Test

## Goal
Verify that all Studio API routes work correctly with our Neon PostgreSQL database. Run a systematic test of each endpoint, confirm DB connectivity, credit system, and job tracking.

## Context
- Project: vendly-storefront (Next.js 15, App Router)
- DB: Neon PostgreSQL (DATABASE_URL in `.env`, NOT `.env.local`)
- DB import: `import { db } from '@/lib/db'` (NOT `prisma` directly)
- Prisma config: `prisma/prisma.config.ts` uses `import 'dotenv/config'`
- Models: StudioCredits, StudioJob, User, UserApiKey
- Superuser emails (unlimited credits): makevytssvadym@gmail.com, akolesnyk1989@gmail.com, 777sdv@gmail.com

## Steps

### Step 1: Verify DB connectivity
```bash
# Check prisma can connect
npx prisma db pull --print 2>&1 | head -20

# Check if tables exist
npx prisma studio &
# Or run a quick query
npx tsx -e "
import { db } from './src/lib/db';
async function main() {
  const users = await db.user.count();
  const credits = await db.studioCredits.count();
  const jobs = await db.studioJob.count();
  console.log({ users, credits, jobs });
}
main().catch(console.error).finally(() => process.exit());
"
```

### Step 2: Check migrations are up to date
```bash
npx prisma migrate status
# If pending migrations:
npx prisma migrate deploy
```

### Step 3: Test credit system
Create a test script `scripts/test-credits.ts`:
```typescript
import { db } from '../src/lib/db';

async function testCredits() {
  // 1. Find or create test user
  const email = 'makevytssvadym@gmail.com';
  const user = await db.user.findFirst({ where: { email } });
  if (!user) {
    console.log('No user found with email:', email);
    return;
  }
  console.log('User:', user.id, user.email);

  // 2. Check credits record
  let credits = await db.studioCredits.findUnique({ where: { userId: user.id } });
  console.log('Credits:', credits);

  // 3. If no credits, they should auto-create on first API call
  if (!credits) {
    console.log('No credits record — will be created on first Studio API call');
  }

  // 4. Verify superuser detection
  const SUPERUSERS = ['makevytssvadym@gmail.com', 'akolesnyk1989@gmail.com', '777sdv@gmail.com'];
  console.log('Is superuser:', SUPERUSERS.includes(email));
}

testCredits().catch(console.error).finally(() => process.exit());
```
Run: `npx tsx scripts/test-credits.ts`

### Step 4: Test API routes with curl (dev server running)
```bash
# Start dev server first
pnpm dev &

# Wait for it to be ready, then:

# 4a. Credits endpoint (needs auth session — test via browser)
# Open http://localhost:3000/studio and check Network tab for /api/studio/credits

# 4b. Test upload route with a sample image
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: <session-cookie>" \
  -F "file=@test-image.jpg" \
  -F "purpose=banner"

# 4c. Test image generation (needs Replicate token)
curl -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"prompt": "test product photo", "aspect": "1:1"}'
```

### Step 5: Verify env vars are set
Check that `.env` has all required vars:
```bash
# Required for Studio:
grep -c "DATABASE_URL=" .env
grep -c "REPLICATE_API_TOKEN\|REPLICATE" .env  
grep -c "AUTH_SECRET=" .env
grep -c "BLOB_READ_WRITE_TOKEN=" .env
grep -c "OPENAI_API_KEY=" .env
grep -c "STRIPE_SECRET_KEY=" .env
```

### Step 6: Run type check
```bash
npx tsc --noEmit
```

## Expected Results
- DB connection works, tables exist
- Migrations are applied
- Credits auto-create for new users
- Superusers bypass credit limits
- Upload processes images to WebP
- All env vars present

## If Issues Found
- Missing tables → `npx prisma migrate deploy`
- Connection refused → Check DATABASE_URL in `.env` (not `.env.local`)
- Auth errors → Check AUTH_SECRET and session config
- Replicate errors → Check REPLICATE_API_TOKEN
