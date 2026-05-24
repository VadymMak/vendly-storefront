import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCreditStatus } from '@/lib/credits';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await getCreditStatus(session.user.id);
  return NextResponse.json(status);
}
