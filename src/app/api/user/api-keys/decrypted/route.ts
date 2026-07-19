import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = req.nextUrl.searchParams.get('provider');
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

  const record = await db.userApiKey.findUnique({
    where:  { userId_provider: { userId: session.user.id, provider } },
    select: { encryptedKey: true },
  });

  if (!record) return NextResponse.json({ key: null });

  return NextResponse.json({ key: decrypt(record.encryptedKey) });
}
