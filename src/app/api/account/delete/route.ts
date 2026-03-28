import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * DELETE /api/account/delete
 * Permanently delete user account and all associated data (GDPR Article 17).
 * Cascade: user → stores → items, orders, reviews, bookings, blog posts
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Get all store IDs owned by user
    const stores = await db.store.findMany({
      where: { userId },
      select: { id: true },
    });

    const storeIds = stores.map((s) => s.id);

    // Cascade delete in correct order (respecting foreign key constraints)
    // Items, Orders, Reviews, Bookings, BlogPosts have onDelete: Cascade on Store,
    // but we delete explicitly for clarity and safety.
    if (storeIds.length > 0) {
      await db.$transaction([
        // Delete store-level data
        db.review.deleteMany({ where: { storeId: { in: storeIds } } }),
        db.order.deleteMany({ where: { storeId: { in: storeIds } } }),
        db.item.deleteMany({ where: { storeId: { in: storeIds } } }),
        db.booking.deleteMany({ where: { storeId: { in: storeIds } } }),
        db.blogPost.deleteMany({ where: { storeId: { in: storeIds } } }),
        // Delete stores
        db.store.deleteMany({ where: { userId } }),
        // Delete user
        db.user.delete({ where: { id: userId } }),
      ]);
    } else {
      // No stores — just delete user
      await db.user.delete({ where: { id: userId } });
    }

    return NextResponse.json({ success: true, message: 'Account and all data permanently deleted' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
