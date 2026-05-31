import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isSuperuser, PLAN_CREDITS } from '@/lib/credits';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const superuser = await isSuperuser(session.user.id);
  if (!superuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const paidUsers = await db.user.findMany({
    where: { studioPaid: true },
    select: { id: true, email: true },
  });

  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  let migrated = 0;
  let skipped = 0;

  for (const user of paidUsers) {
    const existing = await db.studioCredits.findUnique({
      where: { userId: user.id },
    });

    if (existing?.existingUserMigration) {
      skipped++;
      continue;
    }

    if (existing) {
      await db.studioCredits.update({
        where: { userId: user.id },
        data: {
          planType:             'starter',
          monthlyImages:        PLAN_CREDITS.starter.images,
          monthlyVideos:        PLAN_CREDITS.starter.videos,
          existingUserMigration: true,
          migrationExpiresAt:   sixMonthsFromNow,
        },
      });
    } else {
      await db.studioCredits.create({
        data: {
          userId:               user.id,
          planType:             'starter',
          monthlyImages:        PLAN_CREDITS.starter.images,
          monthlyVideos:        PLAN_CREDITS.starter.videos,
          existingUserMigration: true,
          migrationExpiresAt:   sixMonthsFromNow,
          lastReset:            new Date(),
        },
      });
    }
    migrated++;
  }

  return NextResponse.json({
    total:     paidUsers.length,
    migrated,
    skipped,
    expiresAt: sixMonthsFromNow.toISOString(),
  });
}
