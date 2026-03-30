import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { ShopData, ShopItem, ShopSettings, OwnerPlan, ItemType } from '@/lib/types';
import { resolveUserPlan } from '@/lib/shop-queries';

/** Full data needed by the FloatingAdvisor panel. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const store = await db.store.findFirst({
    where: { id, userId: session.user.id },
    include: { user: { select: { plan: true, email: true } } },
  });
  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [rawItems, catGroups] = await Promise.all([
    db.item.findMany({
      where: { storeId: id },
      select: {
        id: true, type: true, name: true, description: true,
        price: true, currency: true, category: true, images: true,
        isAvailable: true, sortOrder: true, metadata: true,
      },
    }),
    db.item.groupBy({
      by: ['category'],
      where: { storeId: id, category: { not: null } },
    }),
  ]);

  const shopData: ShopData = {
    id: store.id,
    slug: store.slug,
    customDomain: store.customDomain,
    name: store.name,
    description: store.description,
    logo: store.logo,
    templateId: store.templateId,
    shopLanguage: store.shopLanguage,
    settings: store.settings as unknown as ShopSettings,
    isPublished: store.isPublished,
    ownerPlan: resolveUserPlan(store.user) as OwnerPlan,
  };

  const items: ShopItem[] = rawItems.map((i) => ({
    ...i,
    type: i.type as ItemType,
    metadata: (i.metadata as Record<string, unknown>) ?? null,
  }));

  return NextResponse.json({
    store: shopData,
    items,
    categoryCount: catGroups.length,
  });
}
