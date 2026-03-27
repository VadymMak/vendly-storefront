import { db } from './db';
import type { ShopData, ShopItem, ShopSettings, ShopReview } from './types';

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
