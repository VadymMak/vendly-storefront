import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/** GET /api/stores/[id]/categories — list categories with item counts */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: storeId } = await params;

  // Verify store ownership
  const store = await db.store.findFirst({
    where: { id: storeId, userId: session.user.id },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Group items by category and count
  const groups = await db.item.groupBy({
    by: ['category'],
    where: { storeId, category: { not: null } },
    _count: { id: true },
    orderBy: { category: 'asc' },
  });

  const categories = groups
    .filter((g) => g.category !== null)
    .map((g) => ({
      name: g.category as string,
      itemCount: g._count.id,
    }));

  return NextResponse.json({ categories });
}

/** DELETE /api/stores/[id]/categories — delete an empty category (set items' category to null) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: storeId } = await params;
  const body = await req.json();
  const categoryName = body.category;

  if (!categoryName || typeof categoryName !== 'string') {
    return NextResponse.json({ error: 'Category name required' }, { status: 400 });
  }

  // Verify store ownership
  const store = await db.store.findFirst({
    where: { id: storeId, userId: session.user.id },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Check item count for this category
  const count = await db.item.count({
    where: { storeId, category: categoryName },
  });

  if (count > 0) {
    return NextResponse.json(
      { error: 'Cannot delete category with items. Reassign items first.' },
      { status: 400 },
    );
  }

  // Category has 0 items — nothing to update in DB, it simply won't appear anymore
  return NextResponse.json({ success: true });
}
