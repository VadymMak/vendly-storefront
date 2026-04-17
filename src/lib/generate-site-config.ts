import Anthropic from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadData {
  businessName:      string | null;
  businessType:      string;
  contact:           string;
  email:             string | null;
  language:          string;
  address:           string | null;
  workingHours:      string | null;
  socialInstagram:   string | null;
  socialFacebook:    string | null;
  referenceUrl:      string | null;
  wishes:            string | null;
  priceListUrl:      string | null;
  logoUrl:           string | null;
  photoUrls:         string | null; // JSON string: ["url1","url2"]
  briefServicesJson: string | null; // JSON: [{name,price,duration,note}]
  selectedPalette:   string | null;
  selectedHero:      string | null;
  selectedMood:      string | null;
}

export interface SiteConfigFiles {
  configTs: string;
  constantsTs: string;
}

export interface HeroConfigHint {
  heroTextColor: string;
  heroOverlay: string;
  overlayOpacity: number;
  textPosition: 'top' | 'center' | 'bottom';
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a web developer generating configuration files for a business website.
You receive business information and must generate two TypeScript files:
1. config.ts — visual configuration (colors, fonts, layout settings)
2. constants.ts — business data (name, description, services, contacts, working hours, etc.)

RULES:
- Output ONLY valid TypeScript code, no markdown, no explanations
- Use the exact same structure/exports as the template files shown below
- All text content should be in the business's language (detect from the language field)
- Choose appropriate color palette based on business type
- Keep all existing type imports and interfaces unchanged`;
}

function buildUserPrompt(
  lead: LeadData,
  templateConfigTs: string,
  templateConstantsTs: string,
  heroConfig?: HeroConfigHint | null,
): string {
  // Safely extract photo URLs for the prompt
  let photoList = '(none provided)';
  if (lead.photoUrls) {
    try {
      const urls = JSON.parse(lead.photoUrls) as string[];
      if (Array.isArray(urls) && urls.length > 0) {
        photoList = urls.map((u, i) => `  ${i + 1}. ${u}`).join('\n');
      }
    } catch { /* ignore */ }
  }

  // Safely extract structured services
  let servicesList = '(none provided — generate reasonable defaults based on business type)';
  if (lead.briefServicesJson) {
    try {
      const services = JSON.parse(lead.briefServicesJson) as Array<{
        name?: string; price?: string; duration?: string; note?: string;
      }>;
      if (Array.isArray(services) && services.length > 0) {
        servicesList = services
          .filter((s) => s.name)
          .map((s) => {
            const parts = [s.name];
            if (s.price)    parts.push(`price: ${s.price}`);
            if (s.duration) parts.push(`duration: ${s.duration}`);
            if (s.note)     parts.push(`note: ${s.note}`);
            return `  - ${parts.join(' | ')}`;
          })
          .join('\n');
      }
    } catch { /* ignore */ }
  }

  // Map brief palette selection → valid PalettePreset from template types.ts
  const paletteMap: Record<string, string> = {
    dark:         'dark-premium',
    light:        'clean-light',
    warm:         'warm-cozy',
    professional: 'professional',
    natural:      'natural',
    custom:       'professional',
  };
  const resolvedPalette = paletteMap[lead.selectedPalette ?? ''] ?? 'professional';

  return `Here are the TEMPLATE FILES to use as structural reference:

=== TEMPLATE: lib/config.ts ===
${templateConfigTs}

=== TEMPLATE: lib/constants.ts ===
${templateConstantsTs}

=== BUSINESS DATA ===
businessName:    ${lead.businessName ?? '(not provided)'}
businessType:    ${lead.businessType}
language:        ${lead.language}
phone/contact:   ${lead.contact}
email:           ${lead.email ?? '(none)'}
address:         ${lead.address ?? '(none)'}
workingHours:    ${lead.workingHours ?? '(none)'}
instagram:       ${lead.socialInstagram ?? '(none)'}
facebook:        ${lead.socialFacebook ?? '(none)'}
heroStyle:       ${lead.selectedHero ?? 'fullscreen'}
mood:            ${lead.selectedMood ?? 'modern'}
logoUrl:         ${lead.logoUrl ?? '(none)'}
priceListUrl:    ${lead.priceListUrl ?? '(none)'}
wishes:          ${lead.wishes ?? '(none)'}
referenceUrl:    ${lead.referenceUrl ?? '(none)'}

Services from brief form:
${servicesList}

Photo URLs (use in IMAGES.gallery):
${photoList}

=== INSTRUCTIONS FOR config.ts ===
Generate EXACTLY these fields (all required, TypeScript will fail if any is wrong):

  name: string — use businessName above
  tagline: string — short catchphrase in language "${lead.language}"
  templateType: MUST be one of: 'services' | 'schedule' | 'menu' | 'portfolio'
    → use 'menu' for restaurant/food, 'schedule' for fitness/yoga, 'portfolio' for photography, 'services' for everything else
  palette: MUST be one of: 'dark-premium' | 'clean-light' | 'warm-cozy' | 'professional' | 'natural' | 'medical'
    → use exactly: ${resolvedPalette}
    ⚠️ DO NOT invent palette names like 'light', 'dark', 'warm' — they are NOT valid
  language: MUST be one of: 'sk' | 'en' | 'de' | 'cs' | 'uk' | 'ru'
    → use exactly: ${lead.language}
  headingFont: MUST be one of: 'oswald' | 'playfair' | 'cormorant' | 'inter'
    → use 'playfair' for beauty/medical, 'cormorant' for restaurant/bar, 'oswald' for auto/repair, 'inter' for others
  whatsappNumber: string — digits only, no +, no spaces, no dashes
    → use: ${lead.contact.replace(/\D/g, '')}
  contactEmail: string — use email above or empty string ""

=== INSTRUCTIONS FOR constants.ts ===
- SERVICE_CATEGORIES: use the services listed above (translate names to language "${lead.language}")
- CONTACT_ITEMS: fill with address="${lead.address ?? ''}", phone="${lead.contact}", email="${lead.email ?? ''}", hours="${lead.workingHours ?? ''}"
- REVIEWS: write 4 plausible placeholder reviews in language "${lead.language}"
- FAQ_ITEMS: 5 items relevant to ${lead.businessType} in language "${lead.language}"
- NAV_ITEMS: labels in language "${lead.language}"
- IMAGES.gallery: use provided photo URLs (or Unsplash placeholders if none)
- socialInstagram: "${lead.socialInstagram ?? ''}"
- socialFacebook: "${lead.socialFacebook ?? ''}"

All visible text MUST be in language "${lead.language}".

${heroConfig ? `
=== HERO VISUAL SETTINGS (LOCKED — DO NOT CHANGE) ===
These values were determined by automated visual analysis of the business's actual photos.
Use them exactly as provided in config.ts:
  textColor:      ${heroConfig.heroTextColor}
  overlay:        ${heroConfig.heroOverlay}
  overlayOpacity: ${heroConfig.overlayOpacity}
  textPosition:   ${heroConfig.textPosition}
Do NOT override or guess these values.
` : ''}
⚠️ CRITICAL — APOSTROPHES IN STRINGS:
All string values use single quotes in TypeScript. If any text contains an apostrophe (e.g. Ukrainian "об'єму", "зв'яжіться", "п'ятницю", Russian "д'Артаньян"), you MUST escape it as \\' — otherwise the build will fail with a syntax error.
Examples:
  WRONG:  description: 'Доставка води об'єму 19 л'
  CORRECT: description: 'Доставка води об\\'єму 19 л'
  WRONG:  text: 'Зв'яжіться з нами'
  CORRECT: text: 'Зв\\'яжіться з нами'

Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{"configTs": "<full content of config.ts>", "constantsTs": "<full content of constants.ts>"}`;
}

// ─── JSON extraction ─────────────────────────────────────────────────────────

/**
 * Try multiple strategies to extract a valid JSON object from Claude's response.
 * Claude sometimes wraps JSON in markdown fences or adds prose before/after.
 */
function extractJSON(text: string): string {
  // 1. Extract from ```json ... ``` or ``` ... ``` fences
  const fenceMatch = text.match(/```(?:json|typescript|ts)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Find the outermost { ... } span
  const firstBrace = text.indexOf('{');
  const lastBrace  = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }

  // 3. Return trimmed as-is and let JSON.parse surface the real error
  return text.trim();
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateSiteConfig(
  lead: LeadData,
  templateConfigTs: string,
  templateConstantsTs: string,
  heroConfig?: HeroConfigHint | null,
): Promise<SiteConfigFiles> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 16000,
    system:     buildSystemPrompt(),
    messages: [
      {
        role:    'user',
        content: buildUserPrompt(lead, templateConfigTs, templateConstantsTs, heroConfig),
      },
    ],
  });

  const firstContent = response.content[0];
  if (firstContent.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API');
  }

  const raw = firstContent.text;
  console.log('[generate-config] Raw Claude response (first 500 chars):', raw.substring(0, 500));

  const cleaned = extractJSON(raw);
  console.log('[generate-config] Cleaned text (first 500 chars):', cleaned.substring(0, 500));

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[generate-config] Failed to parse. Full response:', raw);
    throw new Error(`Failed to parse JSON from Claude response. Raw output:\n${raw.slice(0, 500)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).configTs !== 'string' ||
    typeof (parsed as Record<string, unknown>).constantsTs !== 'string'
  ) {
    throw new Error(`Unexpected JSON shape from Claude. Got keys: ${Object.keys(parsed as object).join(', ')}`);
  }

  return {
    configTs:    (parsed as SiteConfigFiles).configTs,
    constantsTs: (parsed as SiteConfigFiles).constantsTs,
  };
}
