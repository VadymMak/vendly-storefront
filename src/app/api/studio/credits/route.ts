import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCreditStatus, PLAN_CREDITS } from '@/lib/credits';

const DEFAULT_FREE_STATUS = {
  plan:     'free',
  superuser: false,
  byok:     false,
  monthly: {
    images: { used: 0, total: PLAN_CREDITS.free.images, remaining: PLAN_CREDITS.free.images },
    videos: { used: 0, total: PLAN_CREDITS.free.videos, remaining: PLAN_CREDITS.free.videos },
  },
  bonus:          { images: 0, videos: 0 },
  totalGenerated: { images: 0, videos: 0 },
  phoneVerified:  false,
  lastReset:      new Date().toISOString(),
};

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getCreditStatus(session.user.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[studio/credits]', err);
    return NextResponse.json(DEFAULT_FREE_STATUS);
  }
}
