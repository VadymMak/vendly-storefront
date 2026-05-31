import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { type?: string };
  const type = body.type === 'video' ? 'video' : 'image';

  await db.studioCredits.update({
    where: { userId: session.user.id },
    data: type === 'video'
      ? { totalGeneratedVideos: { increment: 1 } }
      : { totalGeneratedImages: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
