import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/account/export
 * Export all user data as JSON (GDPR Article 20 — data portability).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      uiLanguage: true,
      createdAt: true,
      stores: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          templateId: true,
          shopLanguage: true,
          settings: true,
          isPublished: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              type: true,
              name: true,
              description: true,
              price: true,
              currency: true,
              category: true,
              images: true,
              isAvailable: true,
              sortOrder: true,
              createdAt: true,
            },
          },
          orders: {
            select: {
              id: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              items: true,
              total: true,
              status: true,
              createdAt: true,
            },
          },
          reviews: {
            select: {
              id: true,
              author: true,
              rating: true,
              text: true,
              status: true,
              ownerReply: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const exportData = {
    exportDate: new Date().toISOString(),
    platform: 'VendShop',
    ...user,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="vendshop-data-${userId.slice(0, 8)}.json"`,
    },
  });
}
