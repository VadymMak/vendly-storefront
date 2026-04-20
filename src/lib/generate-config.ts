/**
 * Programmatic generation of config.ts for vendshop-template.
 * No AI involved — uses lead data + deterministic business-type presets.
 *
 * Types mirror vendshop-template/lib/types.ts (kept inline to avoid cross-repo import).
 */

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

// ─── Presets by business type ─────────────────────────────────────────────────
type Preset = { palette: PalettePreset; headingFont: HeadingFont };

const BUSINESS_TYPE_PRESET: Record<string, Preset> = {
  repair:        { palette: 'professional', headingFont: 'oswald'    },
  home_services: { palette: 'clean-light',  headingFont: 'inter'     },
  physical:      { palette: 'clean-light',  headingFont: 'inter'     },
  ecommerce:     { palette: 'professional', headingFont: 'inter'     },
  food:          { palette: 'warm-cozy',    headingFont: 'playfair'  },
  restaurant:    { palette: 'warm-cozy',    headingFont: 'cormorant' },
  beauty:        { palette: 'natural',      headingFont: 'playfair'  },
  health:        { palette: 'medical',      headingFont: 'playfair'  },
  digital:       { palette: 'professional', headingFont: 'inter'     },
  education:     { palette: 'clean-light',  headingFont: 'inter'     },
  photography:   { palette: 'dark-premium', headingFont: 'playfair'  },
  design:        { palette: 'dark-premium', headingFont: 'playfair'  },
};

const DEFAULT_PRESET: Preset = { palette: 'professional', headingFont: 'inter' };

// ─── Template repo mapping ────────────────────────────────────────────────────
const TEMPLATE_REPO_MAP: Record<string, string> = {
  repair:        'vendshop-template-classic',
  home_services: 'vendshop-template-classic',
  physical:      'vendshop-template-classic',
  ecommerce:     'vendshop-template-classic',
  food:          'vendshop-template-warm',
  restaurant:    'vendshop-template-warm',
  beauty:        'vendshop-template-natural',
  health:        'vendshop-template-natural',
  digital:       'vendshop-template-bold',
  education:     'vendshop-template-bold',
  photography:   'vendshop-template-dark',
  design:        'vendshop-template-dark',
};

const DEFAULT_TEMPLATE_REPO = 'vendshop-template-classic';

export function getTemplateRepo(businessType: string): string {
  return TEMPLATE_REPO_MAP[businessType] ?? DEFAULT_TEMPLATE_REPO;
}

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
  const preset  = BUSINESS_TYPE_PRESET[lead.businessType] ?? DEFAULT_PRESET;
  // Empty string is falsy in intent but truthy in JS — trim + explicit check
  const mappedPalette = lead.selectedPalette?.trim()
    ? PALETTE_MAP[lead.selectedPalette.trim()]
    : undefined;
  console.log('[generate-config] selectedPalette:', JSON.stringify(lead.selectedPalette), '→ mapped:', mappedPalette, '→ preset:', preset.palette);
  const palette: PalettePreset = mappedPalette ?? preset.palette;
  const headingFont: HeadingFont = preset.headingFont;

  const templateType: TemplateType =
    ['restaurant', 'food'].includes(lead.businessType) ? 'menu' : 'services';

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
