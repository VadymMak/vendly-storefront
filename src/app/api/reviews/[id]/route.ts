import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const patchSchema = z.object({
  status:     z.enum(['PENDING', 'PUBLISHED', 'REJECTED']).optional(),
  ownerReply: z.string().max(2000).nullable().optional(),
});

/** PATCH — owner: update review status or reply */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    // Verify review belongs to a store owned by this user
    const review = await db.review.findUnique({
      where: { id },
      include: { store: { select: { userId: true } } },
    });

    if (!review) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (review.store.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await db.review.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerReply !== undefined ? { ownerReply: data.ownerReply } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      ownerReply: updated.ownerReply,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    console.error('Review PATCH error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** DELETE — owner: remove review */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const review = await db.review.findUnique({
    where: { id },
    include: { store: { select: { userId: true } } },
  });

  if (!review) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (review.store.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.review.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
