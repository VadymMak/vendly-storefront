import { db } from "@/lib/db";

// Credit allowances per plan (monthly reset values)
export const PLAN_CREDITS = {
  free:         { images: 15,  videos: 0  },
  starter:      { images: 100, videos: 20 },
  pro:          { images: 300, videos: 60 },
  byok_creator: { images: 0,   videos: 0  },
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
 * Check if user has ANY API key saved (for UI status display).
 */
export async function hasAnyApiKey(userId: string): Promise<boolean> {
  const count = await db.userApiKey.count({ where: { userId } });
  return count > 0;
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
  provider?: string,
): Promise<{ allowed: boolean; reason?: string; byok?: boolean }> {
  // Superusers bypass all limits
  if (await isSuperuser(userId)) {
    return { allowed: true, byok: false };
  }

  const credits = await getOrCreateCredits(userId);
  const userPlan = (credits.planType || 'free') as string;

  // Check if user has BYOK key for this provider
  const hasByokKey = provider
    ? await hasUserApiKey(userId, provider)
    : await hasAnyApiKey(userId);

  // ONLY byok_creator gets unlimited bypass — Starter/Pro always use credits
  if (hasByokKey && userPlan === 'byok_creator') {
    return { allowed: true, byok: true };
  }

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
  provider?: string,
): Promise<void> {
  // Ensure row exists + load plan info in one call
  const credits = await getOrCreateCredits(userId);

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

  // Check BYOK status + plan
  const userPlan = (credits.planType || 'free') as string;
  const isByok = provider
    ? await hasUserApiKey(userId, provider)
    : await hasAnyApiKey(userId);

  // ONLY byok_creator skips credit deduction — Starter/Pro always deduct
  if (isByok && userPlan === 'byok_creator') {
    await db.studioCredits.update({
      where: { userId },
      data:
        type === "image"
          ? { totalGeneratedImages: { increment: amount } }
          : { totalGeneratedVideos: { increment: amount } },
    });
    return;
  }

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
 * Atomic credit consumption — check AND deduct in one DB transaction.
 * Prevents negative balances under concurrent requests.
 * Returns { success: true } or { success: false, reason }.
 */
export async function consumeCredits(
  userId: string,
  type: CreditType,
  amount: number = 1,
  provider?: string,
): Promise<{ success: boolean; reason?: string; byok?: boolean }> {
  if (await isSuperuser(userId)) {
    await db.studioCredits.update({
      where: { userId },
      data: type === 'image'
        ? { totalGeneratedImages: { increment: amount } }
        : { totalGeneratedVideos: { increment: amount } },
    });
    return { success: true, byok: false };
  }

  const credits = await getOrCreateCredits(userId);
  const userPlan = (credits.planType || 'free') as string;

  const isByok = provider
    ? await hasUserApiKey(userId, provider)
    : await hasAnyApiKey(userId);

  if (isByok && userPlan === 'byok_creator') {
    await db.studioCredits.update({
      where: { userId },
      data: type === 'image'
        ? { totalGeneratedImages: { increment: amount } }
        : { totalGeneratedVideos: { increment: amount } },
    });
    return { success: true, byok: true };
  }

  const result = await db.$transaction(async (tx) => {
    const current = await tx.studioCredits.findUnique({ where: { userId } });
    if (!current) return { success: false as const, reason: 'No credits record' };

    if (type === 'image') {
      const available = current.monthlyImages + current.bonusImages;
      if (available < amount) {
        return { success: false as const, reason: 'No image credits remaining' };
      }
      const fromBonus   = Math.min(current.bonusImages, amount);
      const fromMonthly = Math.min(current.monthlyImages, amount - fromBonus);
      await tx.studioCredits.update({
        where: { userId },
        data: {
          bonusImages:          { decrement: fromBonus },
          monthlyImages:        { decrement: fromMonthly },
          totalGeneratedImages: { increment: amount },
        },
      });
    } else {
      const available = current.monthlyVideos + current.bonusVideos;
      if (available < amount) {
        const isFree = current.planType === 'free';
        return {
          success: false as const,
          reason: isFree
            ? 'Video generation requires a paid plan or credit pack.'
            : 'No video credits remaining.',
        };
      }
      const fromBonus   = Math.min(current.bonusVideos, amount);
      const fromMonthly = Math.min(current.monthlyVideos, amount - fromBonus);
      await tx.studioCredits.update({
        where: { userId },
        data: {
          bonusVideos:          { decrement: fromBonus },
          monthlyVideos:        { decrement: fromMonthly },
          totalGeneratedVideos: { increment: amount },
        },
      });
    }

    return { success: true as const };
  });

  return result;
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
    features: ['100 images/month', '20 video credits/month', 'Best & HD quality', 'Own API keys'],
  },
  pro: {
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: PLAN_CREDITS.pro,
    features: ['300 images/month', '60 video credits/month', 'Best & HD quality', 'Priority queue', 'Own API keys'],
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
    hasAnyApiKey(userId),
    getOrCreateCredits(userId),
  ]);
  const plan = credits.planType as PlanType;
  const allowance = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

  return {
    plan: credits.planType,
    superuser,
    byok,
    byokUnlimited: byok && plan === 'byok_creator',
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
