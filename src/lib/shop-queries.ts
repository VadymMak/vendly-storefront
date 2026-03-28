import { db } from './db';
import type { ShopData, ShopItem, ShopSettings, ShopReview, DashboardStats, DashboardOrder, BrowseStore, AdminStore, AdminUser } from './types';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/** Returns the effective plan for a user. Admin always gets PRO. */
export async function getUserPlan(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, email: true },
  });
  if (!user) return 'FREE';
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) return 'PRO';
  return user.plan;
}

/** Sync version: resolves plan from user object with email. Admin → PRO. */
export function resolveUserPlan(user: { plan: string; email: string }): string {
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) return 'PRO';
  return user.plan;
}

export async function getStoreBySlug(slug: string): Promise<ShopData | null> {
  const store = await db.store.findUnique({
    where: { slug },
  });

  if (!store) return null;

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logo: store.logo,
    templateId: store.templateId,
    shopLanguage: store.shopLanguage,
    settings: store.settings as unknown as ShopSettings,
    isPublished: store.isPublished,
  };
}

export async function getStoreByDomain(domain: string): Promise<ShopData | null> {
  const store = await db.store.findUnique({
    where: { customDomain: domain },
  });

  if (!store) return null;

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logo: store.logo,
    templateId: store.templateId,
    shopLanguage: store.shopLanguage,
    settings: store.settings as unknown as ShopSettings,
    isPublished: store.isPublished,
  };
}

export async function getStoreItems(
  storeId: string,
  category?: string,
): Promise<ShopItem[]> {
  const where: Record<string, unknown> = {
    storeId,
    isAvailable: true,
  };

  if (category) {
    where.category = category;
  }

  const items = await db.item.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return items.map((item) => ({
    id: item.id,
    type: item.type as ShopItem['type'],
    name: item.name,
    description: item.description,
    price: item.price,
    currency: item.currency,
    category: item.category,
    images: item.images,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder,
    metadata: item.metadata as Record<string, unknown> | null,
  }));
}

export async function getStoreItem(itemId: string): Promise<ShopItem | null> {
  const item = await db.item.findUnique({
    where: { id: itemId },
  });

  if (!item) return null;

  return {
    id: item.id,
    type: item.type as ShopItem['type'],
    name: item.name,
    description: item.description,
    price: item.price,
    currency: item.currency,
    category: item.category,
    images: item.images,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder,
    metadata: item.metadata as Record<string, unknown> | null,
  };
}

export async function getStoreCategories(storeId: string): Promise<string[]> {
  const items = await db.item.findMany({
    where: { storeId, isAvailable: true },
    select: { category: true },
    distinct: ['category'],
  });

  return items
    .map((i) => i.category)
    .filter((c): c is string => c !== null);
}

// ===== Dashboard queries =====

export async function getStoreByUserId(userId: string): Promise<ShopData | null> {
  const store = await db.store.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!store) return null;

  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logo: store.logo,
    templateId: store.templateId,
    shopLanguage: store.shopLanguage,
    settings: store.settings as unknown as ShopSettings,
    isPublished: store.isPublished,
  };
}

export async function getDashboardStats(storeId: string): Promise<DashboardStats> {
  const [itemCount, orderCount, orders] = await Promise.all([
    db.item.count({ where: { storeId } }),
    db.order.count({ where: { storeId } }),
    db.order.findMany({
      where: { storeId, status: { in: ['PAID', 'COMPLETED'] } },
      select: { total: true },
    }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  return { itemCount, orderCount, revenue };
}

export async function getDashboardOrders(storeId: string, limit = 20): Promise<DashboardOrder[]> {
  const orders = await db.order.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));
}

// ===== Browse (marketplace) queries =====

export async function getPublishedStores(templateId?: string): Promise<BrowseStore[]> {
  const where: Record<string, unknown> = { isPublished: true };
  if (templateId) {
    where.templateId = templateId;
  }

  const stores = await db.store.findMany({
    where,
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return stores.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    logo: s.logo,
    templateId: s.templateId,
    itemCount: s._count.items,
    createdAt: s.createdAt.toISOString(),
  }));
}

// ===== Admin queries =====

export async function getAllStoresAdmin(): Promise<AdminStore[]> {
  const stores = await db.store.findMany({
    include: {
      _count: { select: { items: true } },
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return stores.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    templateId: s.templateId,
    isPublished: s.isPublished,
    itemCount: s._count.items,
    userEmail: s.user.email,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getAllUsersAdmin(): Promise<AdminUser[]> {
  const users = await db.user.findMany({
    include: { _count: { select: { stores: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    storeCount: u._count.stores,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function getStoreReviews(storeId: string): Promise<ShopReview[]> {
  const reviews = await db.review.findMany({
    where: { storeId, isVisible: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return reviews.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  }));
}
