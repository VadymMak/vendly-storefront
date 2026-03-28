/**
 * Shop-front translations loader.
 * Loads translations based on the store's shopLanguage (not the visitor's browser locale).
 */

import type { Locale } from '@/i18n/request';

export interface ShopFrontMessages {
  catalog: string;
  item_one: string;
  item_few: string;
  item_many: string;
  emptyCategory: string;
  emptyStore: string;
  aboutUs: string;
  contact: string;
  phone: string;
  address: string;
  writeUs: string;
  storeNotFound: string;
  onlineStore: string;
  // Reviews
  reviews: string;
  reviewsCount: string;
  reviewsEmpty: string;
  leaveReview: string;
  showAllReviews: string;
  reviewName: string;
  reviewEmail: string;
  reviewText: string;
  reviewRating: string;
  reviewSubmit: string;
  reviewThanks: string;
  reviewError: string;
  reviewSpam: string;
  ownerReply: string;
}

const VALID_LOCALES = new Set(['en', 'sk', 'uk', 'cs', 'de']);

export async function getShopTranslations(shopLanguage: string): Promise<ShopFrontMessages> {
  const locale: Locale = VALID_LOCALES.has(shopLanguage)
    ? (shopLanguage as Locale)
    : 'sk';

  const messages = (await import(`../../messages/${locale}.json`)).default;
  return messages.shopFront as ShopFrontMessages;
}

/** Pluralization helper for item counts */
export function pluralizeItems(count: number, t: ShopFrontMessages): string {
  if (count === 1) return `${count} ${t.item_one}`;
  if (count >= 2 && count <= 4) return `${count} ${t.item_few}`;
  return `${count} ${t.item_many}`;
}
