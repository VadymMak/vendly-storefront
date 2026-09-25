import { NextResponse } from 'next/server';
import { resetMonthlyCredits } from '@/lib/credits';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resetCount = await resetMonthlyCredits();
    return NextResponse.json({
      success: true,
      resetCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Credit reset cron failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
