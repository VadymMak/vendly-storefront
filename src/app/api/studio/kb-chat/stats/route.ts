import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperuser } from '@/lib/credits';
import { getKbGapStats } from '@/lib/kb/learning';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const superuser = await isSuperuser(session.user.id);
  if (!superuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = Number(req.nextUrl.searchParams.get('days') || '30');
  const stats = await getKbGapStats(days);

  return NextResponse.json(stats);
}
