import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const job = await db.studioJob.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.studioJob.update({
    where: { id },
    data: { status: 'deleted' },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limit  = Math.min(Math.max(parseInt(searchParams.get('limit') || '4', 10), 1), 50);
  const type   = searchParams.get('type'); // 'image' | 'video' | null (all)
  const cursor = searchParams.get('cursor');

  const where: Record<string, unknown> = {
    userId:    session.user.id,
    status:    'succeeded',
    outputUrl: { not: null },
  };

  if (type === 'video') {
    where.type = 'video';
  } else if (type === 'image') {
    where.type = { in: ['image', 'upscale', 'remove-bg', 'ai-edit'] };
  }

  if (cursor) {
    where.id = { lt: cursor };
  }

  const jobs = await db.studioJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    limit,
    select:  { id: true, type: true, outputUrl: true, metadata: true, createdAt: true },
  });

  const items = jobs.map((job) => {
    const meta = (job.metadata ?? {}) as Record<string, unknown>;
    const isVideo = job.type === 'video';

    return {
      id:        job.id,
      type:      isVideo ? 'video' as const : 'image' as const,
      url:       job.outputUrl!,
      prompt:    (meta.prompt as string) ?? '',
      model:     (meta.modelUsed as string) ?? '',
      style:     (meta.style as string) ?? '',
      operation: job.type,
      createdAt: job.createdAt.toISOString(),
    };
  });

  // Strip blob: / data: URLs that should never be in DB, but just in case
  const validItems = items.filter((item) =>
    item.url.startsWith('https://') || item.url.startsWith('http://') || item.url.startsWith('/')
  );

  return NextResponse.json({
    items:      validItems,
    nextCursor: validItems.length === limit ? (validItems[validItems.length - 1]?.id ?? null) : null,
  });
}
