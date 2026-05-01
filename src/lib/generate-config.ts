/**
 * Programmatic generation of config.ts for vendshop-template.
 * No AI involved — uses lead data + deterministic business-type presets.
 *
 * Types mirror vendshop-template/lib/types.ts (kept inline to avoid cross-repo import).
 */

import { normalizeBusinessType } from './business-types';

// Re-export so existing importers (create-site/route.ts) keep working.
export { getTemplateRepo } from './business-types';

// ─── Mirror types from vendshop-template/lib/types.ts ────────────────────────
type PalettePreset = 'dark-premium' | 'clean-light' | 'warm-cozy' | 'professional' | 'natural' | 'medical';
type TemplateType  = 'services' | 'schedule' | 'menu' | 'portfolio';
type HeadingFont   = 'oswald' | 'playfair' | 'cormorant' | 'inter';
type SiteLanguage  = 'sk' | 'en' | 'de' | 'cs' | 'uk' | 'ru';

// ─── Input type ───────────────────────────────────────────────────────────────
export interface LeadConfigInput {
  businessName:    string | null;
  businessType:    string;
  contact:         string;           // raw phone string
  email:           string | null;
  language:        string;
  selectedPalette: string | null;    // brief values: dark | light | warm | professional | natural | custom
}

// ─── Presets by canonical business slug ───────────────────────────────────────
// Keyed by the canonical wizard slugs (see src/lib/business-types.ts). Legacy
// DB values are normalized via normalizeBusinessType before lookup.
type Preset = { palette: PalettePreset; headingFont: HeadingFont };

const BUSINESS_TYPE_PRESET: Record<string, Preset> = {
  barbershop:  { palette: 'professional', headingFont: 'oswald'    },
  restaurant:  { palette: 'warm-cozy',    headingFont: 'cormorant' },
  beauty:      { palette: 'natural',      headingFont: 'playfair'  },
  auto:        { palette: 'professional', headingFont: 'oswald'    },
  dentist:     { palette: 'medical',      headingFont: 'playfair'  },
  water:       { palette: 'clean-light',  headingFont: 'inter'     },
  electronics: { palette: 'professional', headingFont: 'oswald'    },
  yoga:        { palette: 'natural',      headingFont: 'playfair'  },
  photography: { palette: 'dark-premium', headingFont: 'playfair'  },
  agency:      { palette: 'professional', headingFont: 'inter'     },
  education:   { palette: 'clean-light',  headingFont: 'inter'     },
  design:      { palette: 'dark-premium', headingFont: 'playfair'  },
};

const DEFAULT_PRESET: Preset = { palette: 'professional', headingFont: 'inter' };

// ─── Brief palette → PalettePreset mapping ────────────────────────────────────
const PALETTE_MAP: Record<string, PalettePreset> = {
  dark:         'dark-premium',
  light:        'clean-light',
  warm:         'warm-cozy',
  professional: 'professional',
  natural:      'natural',
  custom:       'professional',
};

// ─── Valid language values ────────────────────────────────────────────────────
const VALID_LANGS: SiteLanguage[] = ['sk', 'en', 'de', 'cs', 'uk', 'ru'];

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateConfigTs(lead: LeadConfigInput): string {
  const canonical = normalizeBusinessType(lead.businessType) ?? lead.businessType;
  const preset    = BUSINESS_TYPE_PRESET[canonical] ?? DEFAULT_PRESET;
  // Empty string is falsy in intent but truthy in JS — trim + explicit check
  const mappedPalette = lead.selectedPalette?.trim()
    ? PALETTE_MAP[lead.selectedPalette.trim()]
    : undefined;
  console.log('[generate-config] selectedPalette:', JSON.stringify(lead.selectedPalette), '→ mapped:', mappedPalette, '→ preset:', preset.palette);
  const palette: PalettePreset = mappedPalette ?? preset.palette;
  const headingFont: HeadingFont = preset.headingFont;

  const templateType: TemplateType = canonical === 'restaurant' ? 'menu' : 'services';

  const language: SiteLanguage = VALID_LANGS.includes(lead.language as SiteLanguage)
    ? (lead.language as SiteLanguage)
    : 'sk';

  // Escape backslashes first, then single quotes
  const safeName  = (lead.businessName ?? 'Your Business')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  const safeEmail = (lead.email ?? '').replace(/'/g, "\\'");
  const safePhone = lead.contact.replace(/\D/g, '');

  return `import type { SiteConfig } from './types';

export const SITE_CONFIG: SiteConfig = {
  name: '${safeName}',
  tagline: '',
  templateType: '${templateType}',
  palette: '${palette}',
  language: '${language}',
  headingFont: '${headingFont}',
  whatsappNumber: '${safePhone}',
  contactEmail: '${safeEmail}',
};
`;
}
