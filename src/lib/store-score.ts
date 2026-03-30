import type { ShopData, ShopItem, ScoreCheck, StoreScoreResult } from './types';

/**
 * Rule-based Store Score calculator.
 * Returns a 0-100 score and a list of checks with pass/fail status.
 * Available for all plans (FREE included).
 */
export function calculateStoreScore(
  store: ShopData,
  items: ShopItem[],
  categoryCount: number,
): StoreScoreResult {
  const checks: ScoreCheck[] = [];

  // ── Critical checks (weight: 10 each) ─────────────────────────────────
  checks.push({
    id: 'hasName',
    level: 'critical',
    passed: !!store.name.trim(),
    labelKey: 'scoreHasName',
    tab: 'general',
  });

  checks.push({
    id: 'hasItems',
    level: 'critical',
    passed: items.length > 0,
    labelKey: 'scoreHasItems',
  });

  checks.push({
    id: 'isPublished',
    level: 'critical',
    passed: store.isPublished,
    labelKey: 'scoreIsPublished',
    tab: 'publishing',
  });

  // ── Warning checks (weight: 7 each) ───────────────────────────────────
  checks.push({
    id: 'hasLogo',
    level: 'warning',
    passed: !!store.logo,
    labelKey: 'scoreHasLogo',
    tab: 'design',
  });

  checks.push({
    id: 'hasDescription',
    level: 'warning',
    passed: !!store.description?.trim(),
    labelKey: 'scoreHasDescription',
    tab: 'general',
  });

  checks.push({
    id: 'hasBanner',
    level: 'warning',
    passed: !!store.settings.bannerImage,
    labelKey: 'scoreHasBanner',
    tab: 'design',
  });

  checks.push({
    id: 'hasPhone',
    level: 'warning',
    passed: !!store.settings.phone?.trim(),
    labelKey: 'scoreHasPhone',
    tab: 'contact',
  });

  checks.push({
    id: 'hasAddress',
    level: 'warning',
    passed: !!store.settings.address?.trim(),
    labelKey: 'scoreHasAddress',
    tab: 'contact',
  });

  checks.push({
    id: 'hasHours',
    level: 'warning',
    passed: !!store.settings.structuredHours?.some((d) => d.open),
    labelKey: 'scoreHasHours',
    tab: 'contact',
  });

  checks.push({
    id: 'minItems',
    level: 'warning',
    passed: items.length >= 5,
    labelKey: 'scoreMinItems',
  });

  checks.push({
    id: 'allItemsHavePhotos',
    level: 'warning',
    passed: items.length > 0 && items.every((i) => i.images.length > 0),
    labelKey: 'scoreAllPhotos',
  });

  checks.push({
    id: 'allItemsHaveDesc',
    level: 'warning',
    passed: items.length > 0 && items.every((i) => !!i.description?.trim()),
    labelKey: 'scoreAllDescriptions',
  });

  checks.push({
    id: 'minCategories',
    level: 'warning',
    passed: categoryCount >= 2,
    labelKey: 'scoreMinCategories',
    tab: 'categories',
  });

  // ── Bonus checks (weight: 4 each) ─────────────────────────────────────
  checks.push({
    id: 'hasPromo',
    level: 'bonus',
    passed: (store.settings.promoBanners?.length ?? 0) > 0,
    labelKey: 'scoreHasPromo',
    tab: 'promo',
  });

  checks.push({
    id: 'hasSocial',
    level: 'bonus',
    passed: !!(store.settings.instagram?.trim() || store.settings.facebook?.trim()),
    labelKey: 'scoreHasSocial',
    tab: 'contact',
  });

  checks.push({
    id: 'hasWhatsapp',
    level: 'bonus',
    passed: !!store.settings.whatsapp?.trim(),
    labelKey: 'scoreHasWhatsapp',
    tab: 'contact',
  });

  checks.push({
    id: 'hasAbout',
    level: 'bonus',
    passed: !!store.settings.aboutText?.trim(),
    labelKey: 'scoreHasAbout',
    tab: 'general',
  });

  checks.push({
    id: 'hasDelivery',
    level: 'bonus',
    passed: !!store.settings.deliveryInfo?.trim(),
    labelKey: 'scoreHasDelivery',
    tab: 'contact',
  });

  // ── Calculate score ────────────────────────────────────────────────────
  const WEIGHTS: Record<string, number> = { critical: 10, warning: 7, bonus: 4 };
  const maxScore = checks.reduce((sum, c) => sum + WEIGHTS[c.level], 0);
  const earnedScore = checks.filter((c) => c.passed).reduce((sum, c) => sum + WEIGHTS[c.level], 0);
  const score = Math.round((earnedScore / maxScore) * 100);

  return { score, checks };
}
