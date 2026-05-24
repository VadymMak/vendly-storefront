import { NextResponse } from 'next/server';
import { resetMonthlyCredits } from '@/lib/credits';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
