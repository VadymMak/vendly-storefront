import { db } from '@/lib/db';

// Credit allowances per plan (monthly reset values)
export const PLAN_CREDITS = {
  free:    { images: 5,   videos: 1 },
  starter: { images: 50,  videos: 3 },
  pro:     { images: 150, videos: 8 },
} as const;

export type PlanType = keyof typeof PLAN_CREDITS;
export type CreditType = 'image' | 'video';

// Superusers — unlimited access, no credit deduction
export const SUPERUSER_EMAILS = [
  'makevytssvadym@gmail.com',
  'akolisnyk1989@gmail.com',
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
  return (SUPERUSER_EMAILS as readonly string[]).includes(user.email.toLowerCase());
}

// How many credits a video costs (5s=1, 10s=2)
export function getVideoCreditCost(durationSeconds: number): number {
  return durationSeconds <= 5 ? 1 : 2;
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

  const credits = await getOrCreateCredits(userId);

  // BYOK users bypass credit system
  if (credits.byokEnabled && credits.replicateKey) {
    return { allowed: true, byok: true };
  }

  if (type === 'image') {
    const available = credits.monthlyImages + credits.bonusImages;
    if (available < amount) {
      return { allowed: false, reason: 'No image credits remaining' };
    }
  } else {
    const available = credits.monthlyVideos + credits.bonusVideos;
    if (available < amount) {
      return { allowed: false, reason: 'No video credits remaining' };
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
  // Superusers — only track stats, no deduction
  if (await isSuperuser(userId)) {
    await db.studioCredits.update({
      where: { userId },
      data: type === 'image'
        ? { totalGeneratedImages: { increment: amount } }
        : { totalGeneratedVideos: { increment: amount } },
    });
    return;
  }

  const credits = await getOrCreateCredits(userId);

  // BYOK — no deduction, just track stats
  if (credits.byokEnabled && credits.replicateKey) {
    await db.studioCredits.update({
      where: { userId },
      data: type === 'image'
        ? { totalGeneratedImages: { increment: amount } }
        : { totalGeneratedVideos: { increment: amount } },
    });
    return;
  }

  if (type === 'image') {
    const fromBonus = Math.min(credits.bonusImages, amount);
    const fromMonthly = Math.min(credits.monthlyImages, amount - fromBonus);

    await db.studioCredits.update({
      where: { userId },
      data: {
        bonusImages:          { decrement: fromBonus },
        monthlyImages:        { decrement: fromMonthly },
        totalGeneratedImages: { increment: amount },
      },
    });
  } else {
    const fromBonus = Math.min(credits.bonusVideos, amount);
    const fromMonthly = Math.min(credits.monthlyVideos, amount - fromBonus);

    await db.studioCredits.update({
      where: { userId },
      data: {
        bonusVideos:          { decrement: fromBonus },
        monthlyVideos:        { decrement: fromMonthly },
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
  for (const user of usersToReset) {
    const plan = user.planType as PlanType;
    const allowance = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

    await db.studioCredits.update({
      where: { id: user.id },
      data: {
        monthlyImages: allowance.images,
        monthlyVideos: allowance.videos,
        lastReset:     new Date(),
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
  await db.studioCredits.update({
    where: { userId },
    data: {
      bonusImages: { increment: images },
      bonusVideos: { increment: videos },
    },
  });
}

/**
 * Get user's current credit status for UI display.
 */
export async function getCreditStatus(userId: string) {
  const credits = await getOrCreateCredits(userId);
  const plan = credits.planType as PlanType;
  const allowance = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

  return {
    plan:  credits.planType,
    byok:  credits.byokEnabled && !!credits.replicateKey,
    monthly: {
      images: {
        used:      allowance.images - credits.monthlyImages,
        total:     allowance.images,
        remaining: credits.monthlyImages,
      },
      videos: {
        used:      allowance.videos - credits.monthlyVideos,
        total:     allowance.videos,
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
    lastReset:     credits.lastReset,
  };
}
