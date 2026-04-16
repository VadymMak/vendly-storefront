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
palette:         ${lead.selectedPalette ?? '(auto-select based on business type)'}
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

=== INSTRUCTIONS ===
Generate config.ts and constants.ts customized for this business.
- config.ts: set correct businessName, tagline (short catchphrase in the business language), templateType (services/menu/schedule/portfolio based on businessType), palette, language, headingFont, whatsappNumber (digits only, no + or spaces), contactEmail
- constants.ts: use the services listed above in SERVICE_CATEGORIES; fill CONTACT_ITEMS with real address/phone/email/hours; write REVIEWS as 4 plausible placeholder reviews in the business language; write FAQ_ITEMS relevant to this business type (5 items); update NAV_ITEMS labels to the correct language; IMAGES.gallery should use the provided photo URLs (or keep Unsplash placeholders if none provided)
- All visible text MUST be in language "${lead.language}"

${heroConfig ? `
=== HERO VISUAL SETTINGS (LOCKED — DO NOT CHANGE) ===
These values were determined by automated visual analysis of the business's actual photos.
Use them exactly as provided in config.ts:
  textColor:    ${heroConfig.heroTextColor}
  overlay:      ${heroConfig.heroOverlay}
  overlayOpacity: ${heroConfig.overlayOpacity}
  textPosition: ${heroConfig.textPosition}
Do NOT override or guess these values.
` : ''}
Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{"configTs": "<full content of config.ts>", "constantsTs": "<full content of constants.ts>"}`;
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

  const raw = firstContent.text.trim();

  // Strip markdown code fences if model wrapped JSON in them
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
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
