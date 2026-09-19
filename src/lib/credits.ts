import { db } from "@/lib/db";

// Credit allowances per plan (monthly reset values)
export const PLAN_CREDITS = {
  free: { images: 15, videos: 0 },
  starter: { images: 100, videos: 5 },
  pro: { images: 300, videos: 15 },
} as const;

export type PlanType = keyof typeof PLAN_CREDITS;
export type CreditType = "image" | "video";

// Superusers — unlimited access, no credit deduction
export const SUPERUSER_EMAILS = [
  "makevytssvadym@gmail.com",
  "akolesnyk1989@gmail.com",
  "777sdv@gmail.com",
] as const;

/**
 * Check if user is a superuser (unlimited free access).
 * Requires DB lookup to get email from userId.
 */
export async function isSuperuser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return false;
  return (SUPERUSER_EMAILS as readonly string[]).includes(
    user.email.toLowerCase(),
  );
}

// How many credits a video costs (5s=1, 10s=2)
export function getVideoCreditCost(durationSeconds: number): number {
  return durationSeconds <= 5 ? 1 : 2;
}

/**
 * Single source of truth for BYOK check — reads UserApiKey table.
 */
export async function hasUserApiKey(userId: string, provider: string): Promise<boolean> {
  const key = await db.userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { id: true },
  });
  return Boolean(key);
}

/**
 * Get or create StudioCredits for a user.
 * Auto-creates with free plan defaults if not exists.
 */
export async function getOrCreateCredits(userId: string) {
  let credits = await db.studioCredits.findUnique({
    where: { userId },
  });

  if (!credits) {
    credits = await db.studioCredits.create({
      data: { userId },
    });
  }

  return credits;
}

/**
 * Check if user has enough credits for an operation.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export async function checkCredits(
  userId: string,
  type: CreditType,
  amount: number = 1,
): Promise<{ allowed: boolean; reason?: string; byok?: boolean }> {
  // Superusers bypass all limits
  if (await isSuperuser(userId)) {
    return { allowed: true, byok: false };
  }

  // BYOK users bypass credit system — UserApiKey is single source of truth
  if (await hasUserApiKey(userId, 'replicate')) {
    return { allowed: true, byok: true };
  }

  const credits = await getOrCreateCredits(userId);

  if (type === "image") {
    const available = credits.monthlyImages + credits.bonusImages;
    if (available < amount) {
      return { allowed: false, reason: "No image credits remaining" };
    }
  } else {
    const available = credits.monthlyVideos + credits.bonusVideos;
    if (available < amount) {
      const isFree = credits.planType === 'free';
      return {
        allowed: false,
        reason: isFree
          ? 'Video generation requires a paid plan or credit pack. Upgrade to start creating videos!'
          : 'No video credits remaining. Buy a credit pack or upgrade your plan.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Deduct credits after successful generation.
 * Priority: bonus credits first, then monthly.
 */
export async function deductCredit(
  userId: string,
  type: CreditType,
  amount: number = 1,
): Promise<void> {
  // Ensure row exists before any update (guards against P2025 for new users)
  await getOrCreateCredits(userId);

  // Superusers — only track stats, no deduction
  if (await isSuperuser(userId)) {
    await db.studioCredits.update({
      where: { userId },
      data:
        type === "image"
          ? { totalGeneratedImages: { increment: amount } }
          : { totalGeneratedVideos: { increment: amount } },
    });
    return;
  }

  // BYOK — no deduction, just track stats
  if (await hasUserApiKey(userId, 'replicate')) {
    await db.studioCredits.update({
      where: { userId },
      data:
        type === "image"
          ? { totalGeneratedImages: { increment: amount } }
          : { totalGeneratedVideos: { increment: amount } },
    });
    return;
  }

  const credits = await getOrCreateCredits(userId);

  if (type === "image") {
    const fromBonus = Math.min(credits.bonusImages, amount);
    const fromMonthly = Math.min(credits.monthlyImages, amount - fromBonus);

    await db.studioCredits.update({
      where: { userId },
      data: {
        bonusImages: { decrement: fromBonus },
        monthlyImages: { decrement: fromMonthly },
        totalGeneratedImages: { increment: amount },
      },
    });
  } else {
    const fromBonus = Math.min(credits.bonusVideos, amount);
    const fromMonthly = Math.min(credits.monthlyVideos, amount - fromBonus);

    await db.studioCredits.update({
      where: { userId },
      data: {
        bonusVideos: { decrement: fromBonus },
        monthlyVideos: { decrement: fromMonthly },
        totalGeneratedVideos: { increment: amount },
      },
    });
  }
}

/**
 * Reset monthly credits based on plan.
 * Called by Vercel Cron daily at 02:00 UTC.
 * Only resets users whose lastReset is >30 days ago.
 */
export async function resetMonthlyCredits(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const usersToReset = await db.studioCredits.findMany({
    where: { lastReset: { lt: thirtyDaysAgo } },
  });

  let resetCount = 0;
  const now = new Date();

  for (const user of usersToReset) {
    // Migration expired — downgrade to free before resetting
    if (
      user.existingUserMigration &&
      user.migrationExpiresAt &&
      now > user.migrationExpiresAt
    ) {
      await db.studioCredits.update({
        where: { id: user.id },
        data: {
          planType: "free",
          monthlyImages: PLAN_CREDITS.free.images,
          monthlyVideos: PLAN_CREDITS.free.videos,
          existingUserMigration: false,
          migrationExpiresAt: null,
          lastReset: now,
        },
      });
      resetCount++;
      continue;
    }

    const plan = user.planType as PlanType;
    const allowance = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

    await db.studioCredits.update({
      where: { id: user.id },
      data: {
        monthlyImages: allowance.images,
        monthlyVideos: allowance.videos,
        lastReset: now,
      },
    });
    resetCount++;
  }

  return resetCount;
}

/**
 * Add bonus credits from credit pack purchase.
 */
export async function addBonusCredits(
  userId: string,
  images: number,
  videos: number,
): Promise<void> {
  // Ensure row exists before update (guards against P2025 for new users)
  await getOrCreateCredits(userId);

  await db.studioCredits.update({
    where: { userId },
    data: {
      bonusImages: { increment: images },
      bonusVideos: { increment: videos },
    },
  });
}

export const SUBSCRIPTION_PLANS = {
  starter: {
    name: 'Starter',
    price: 9,
    priceId: process.env.STRIPE_PRICE_STARTER!,
    credits: PLAN_CREDITS.starter,
    features: ['100 images/month', '5 videos/month', 'Best & HD quality', 'BYOK option'],
  },
  pro: {
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: PLAN_CREDITS.pro,
    features: ['300 images/month', '15 videos/month', 'Best & HD quality', 'Priority queue', 'BYOK option'],
  },
  byok_creator: {
    name: 'BYOK Creator',
    price: 7,
    priceId: process.env.STRIPE_PRICE_BYOK!,
    credits: { images: 0, videos: 0 },
    features: ['Unlimited with your API keys', 'All models unlocked', 'Priority queue'],
  },
} as const;

/**
 * Get user's current credit status for UI display.
 */
export async function getCreditStatus(userId: string) {
  const [superuser, byok, credits] = await Promise.all([
    isSuperuser(userId).catch(() => false),
    hasUserApiKey(userId, 'replicate'),
    getOrCreateCredits(userId),
  ]);
  const plan = credits.planType as PlanType;
  const allowance = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

  return {
    plan: credits.planType,
    superuser,
    byok,
    monthly: {
      images: {
        used: allowance.images - credits.monthlyImages,
        total: allowance.images,
        remaining: credits.monthlyImages,
      },
      videos: {
        used: allowance.videos - credits.monthlyVideos,
        total: allowance.videos,
        remaining: credits.monthlyVideos,
      },
    },
    bonus: {
      images: credits.bonusImages,
      videos: credits.bonusVideos,
    },
    totalGenerated: {
      images: credits.totalGeneratedImages,
      videos: credits.totalGeneratedVideos,
    },
    phoneVerified: credits.phoneVerified,
    lastReset: credits.lastReset,
  };
}
