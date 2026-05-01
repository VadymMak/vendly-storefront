/**
 * Canonical business taxonomy — single source of truth shared by the /create
 * wizard, the admin leads form, and the create-site / generate-config pipeline.
 *
 * The 12 slugs match the ids used in CREATE_BUSINESS_TYPES (constants.ts) and
 * what /api/submit-lead writes to lead.businessType. Labels are admin-facing
 * English; the wizard renders its own i18n labels via next-intl.
 *
 * Template repos refer to GitHub repos under VadymMak/. Do not invent new repo
 * names here — every templateRepo below must already exist on GitHub.
 */

export const BUSINESS_TYPES = [
  { slug: 'barbershop',  label: 'Barbershop',         templateRepo: 'vendshop-template-classic' },
  { slug: 'restaurant',  label: 'Restaurant',         templateRepo: 'vendshop-template-warm'    },
  { slug: 'beauty',      label: 'Beauty Salon',       templateRepo: 'vendshop-template-natural' },
  { slug: 'auto',        label: 'Auto Service',       templateRepo: 'vendshop-template-classic' },
  { slug: 'dentist',     label: 'Dentist',            templateRepo: 'vendshop-template-natural' },
  { slug: 'water',       label: 'Water Delivery',     templateRepo: 'vendshop-template-classic' },
  { slug: 'electronics', label: 'Electronics Repair', templateRepo: 'vendshop-template-classic' },
  { slug: 'yoga',        label: 'Yoga Studio',        templateRepo: 'vendshop-template-natural' },
  { slug: 'photography', label: 'Photography',        templateRepo: 'vendshop-template-dark'    },
  { slug: 'agency',      label: 'Agency',             templateRepo: 'vendshop-template-bold'    },
  { slug: 'education',   label: 'Education',          templateRepo: 'vendshop-template-bold'    },
  { slug: 'design',      label: 'Design Studio',      templateRepo: 'vendshop-template-dark'    },
] as const;

export type BusinessTypeSlug = typeof BUSINESS_TYPES[number]['slug'];

const DEFAULT_TEMPLATE_REPO = 'vendshop-template-classic';

/**
 * Maps legacy slugs from older flows (OnboardingChat, dashboard SettingsForm,
 * templates page) onto the canonical wizard taxonomy. Old leads keep working
 * without a data migration — getTemplateRepo and normalize routes them here.
 */
const LEGACY_TYPE_MAP: Record<string, BusinessTypeSlug> = {
  food:          'restaurant',
  bar:           'restaurant',
  repair:        'electronics',
  services:      'agency',
  home_services: 'agency',
  digital:       'agency',
  ecommerce:     'agency',
  health:        'dentist',
  medical:       'dentist',
  fitness:       'yoga',
  physical:      'barbershop',
};

export function normalizeBusinessType(slug: string | null | undefined): BusinessTypeSlug | null {
  if (!slug) return null;
  if ((BUSINESS_TYPES as readonly { slug: string }[]).some((t) => t.slug === slug)) {
    return slug as BusinessTypeSlug;
  }
  return LEGACY_TYPE_MAP[slug] ?? null;
}

export function getBusinessType(slug: string | null | undefined) {
  const canonical = normalizeBusinessType(slug);
  if (!canonical) return undefined;
  return BUSINESS_TYPES.find((t) => t.slug === canonical);
}

export function getTemplateRepo(slug: string | null | undefined): string {
  return getBusinessType(slug)?.templateRepo ?? DEFAULT_TEMPLATE_REPO;
}

/**
 * Resolved hero layout used by the live site pipeline. Mirrors the wizard
 * preview's auto-resolution rule: classic / bold / dark templates render
 * full-bleed; warm / natural / medical render split-half.
 */
const FULL_BLEED_TEMPLATE_REPOS: ReadonlySet<string> = new Set([
  'vendshop-template-classic',
  'vendshop-template-bold',
  'vendshop-template-dark',
]);

export type ResolvedHeroLayout = 'split' | 'full';

export function getDefaultHeroLayout(slug: string | null | undefined): ResolvedHeroLayout {
  return FULL_BLEED_TEMPLATE_REPOS.has(getTemplateRepo(slug)) ? 'full' : 'split';
}

/**
 * Resolve the wizard's heroLayout preference into a definitive 'split' | 'full'
 * value to pass to the template generator. Anything other than 'split' or
 * 'full' (including 'auto', null, undefined, legacy values) falls back to the
 * per-business-type default.
 */
export function resolveHeroLayout(
  preference: string | null | undefined,
  slug: string | null | undefined,
): ResolvedHeroLayout {
  if (preference === 'split' || preference === 'full') return preference;
  return getDefaultHeroLayout(slug);
}
