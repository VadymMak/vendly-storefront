import { db } from './db';
import type { ShopData, ShopItem, ShopSettings, ShopReview, DashboardReview, DashboardStats, DashboardOrder, BrowseStore, AdminStore, AdminUser, ReviewStatus, OwnerPlan } from './types';

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
    include: { user: { select: { plan: true, email: true } } },
  });

  if (!store) return null;

  return {
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
}

export async function getStoreByDomain(domain: string): Promise<ShopData | null> {
  const store = await db.store.findUnique({
    where: { customDomain: domain },
    include: { user: { select: { plan: true, email: true } } },
  });

  if (!store) return null;

  return {
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
}

export async function getStoreItems(
  storeId: string,
  category?: string,
  query?: string,
): Promise<ShopItem[]> {
  const where: Record<string, unknown> = {
    storeId,
    isAvailable: true,
  };

  if (category) {
    where.category = category;
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
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

export async function getRelatedItems(
  storeId: string,
  currentItemId: string,
  category: string | null,
  limit = 4,
): Promise<ShopItem[]> {
  // First try same category, then fallback to any items from the store
  const items = await db.item.findMany({
    where: {
      storeId,
      isAvailable: true,
      id: { not: currentItemId },
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // If not enough from same category, fill with other items
  if (items.length < limit && category) {
    const moreIds = new Set(items.map(i => i.id));
    const more = await db.item.findMany({
      where: {
        storeId,
        isAvailable: true,
        id: { notIn: [currentItemId, ...moreIds] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit - items.length,
    });
    items.push(...more);
  }

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
    include: { user: { select: { plan: true, email: true } } },
  });

  if (!store) return null;

  return {
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

/** Published reviews for shop storefront */
export async function getStoreReviews(storeId: string): Promise<ShopReview[]> {
  const reviews = await db.review.findMany({
    where: { storeId, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return reviews.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    text: r.text,
    ownerReply: r.ownerReply,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Average rating for a store */
export async function getStoreAverageRating(storeId: string): Promise<{ avg: number; count: number }> {
  const result = await db.review.aggregate({
    where: { storeId, status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    avg: result._avg.rating ? Math.round(result._avg.rating * 10) / 10 : 0,
    count: result._count.rating,
  };
}

/** All reviews for dashboard moderation */
export async function getDashboardReviews(storeId: string, status?: ReviewStatus): Promise<DashboardReview[]> {
  const reviews = await db.review.findMany({
    where: { storeId, ...(status ? { status } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return reviews.map((r) => ({
    id: r.id,
    author: r.author,
    authorEmail: r.authorEmail,
    rating: r.rating,
    text: r.text,
    status: r.status as ReviewStatus,
    ownerReply: r.ownerReply,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Count reviews by IP in the last 24 hours (spam protection) */
export async function countRecentReviewsByIp(ip: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.review.count({
    where: { ipAddress: ip, createdAt: { gte: since } },
  });
}
