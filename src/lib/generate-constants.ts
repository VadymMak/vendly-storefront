/**
 * AI-powered generation of constants.ts for vendshop-template.
 * Claude receives the template structure and business data, outputs raw TypeScript.
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Input type ───────────────────────────────────────────────────────────────
export interface LeadConstantsInput {
  businessName:      string | null;
  businessType:      string;
  contact:           string;
  email:             string | null;
  language:          string;
  address:           string | null;
  workingHours:      string | null;
  socialInstagram:   string | null;
  socialFacebook:    string | null;
  wishes:            string | null;
  photoUrls:         string | null;  // JSON string: ["url1","url2"]
  briefServicesJson: string | null;  // JSON string: [{name,price,duration,note}]
}

// ─── Required import block (always prepended if Claude omits it) ─────────────
const REQUIRED_IMPORTS = `import type {
  NavItem,
  StatItem,
  WhyItem,
  GalleryImage,
  Review,
  ContactItem,
  FaqItem,
  ChatConfig,
  ServiceCategory,
  DaySchedule,
  MenuCategory,
  ImageMap,
} from './types';`;

// ─── Extract TypeScript code from Claude response ─────────────────────────────
function extractConstantsCode(text: string): string | null {
  // 1. Explicit typescript/ts code fence
  const fenceMatch = text.match(/```(?:typescript|ts)\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Any code fence (in case model uses plain ```)
  const plainFence = text.match(/```\s*\n([\s\S]*?)\n```/);
  if (plainFence) return plainFence[1].trim();

  // 3. Find from `import type {` or `import {` — start of a TS file with imports
  const importTypeIdx = text.indexOf('import type {');
  if (importTypeIdx !== -1) return text.substring(importTypeIdx).trim();

  const importIdx = text.indexOf('import {');
  if (importIdx !== -1) return text.substring(importIdx).trim();

  // 4. Find from first `export const` — Claude skipped the import block
  const exportIdx = text.indexOf('export const');
  if (exportIdx !== -1) return text.substring(exportIdx).trim();

  return null;
}

/** Ensure the import block is always present at the top of generated constants.ts */
function ensureImports(code: string): string {
  if (code.trimStart().startsWith('import')) return code;
  // Claude omitted the import block — prepend it
  console.warn('[generate-constants] Import block missing — prepending required imports');
  return `${REQUIRED_IMPORTS}\n\n${code}`;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(lead: LeadConstantsInput, templateConstants: string): string {
  // Parse photoUrls safely
  let photoList = '(none provided — use Unsplash placeholders)';
  if (lead.photoUrls) {
    try {
      const urls = JSON.parse(lead.photoUrls) as unknown;
      if (Array.isArray(urls) && urls.length > 0) {
        photoList = (urls as string[]).filter(Boolean).map((u, i) => `  ${i + 1}. ${u}`).join('\n');
      }
    } catch { /* ignore */ }
  }

  // Parse briefServicesJson safely
  let servicesList = '(none — generate 2-3 realistic service categories for this business type)';
  if (lead.briefServicesJson) {
    try {
      const services = JSON.parse(lead.briefServicesJson) as Array<{
        name?: string; price?: string; duration?: string; note?: string;
      }>;
      if (Array.isArray(services) && services.length > 0) {
        servicesList = services
          .filter((s) => s.name)
          .map((s) => {
            const parts: string[] = [s.name!];
            if (s.price)    parts.push(`price: ${s.price}`);
            if (s.duration) parts.push(`duration: ${s.duration}`);
            if (s.note)     parts.push(`note: ${s.note}`);
            return `  - ${parts.join(' | ')}`;
          })
          .join('\n');
      }
    } catch { /* ignore */ }
  }

  return `You are generating a TypeScript constants file (constants.ts) for a business website.

=== TEMPLATE STRUCTURE (follow this exact shape and all exports) ===
${templateConstants}

=== BUSINESS DATA ===
name:          ${lead.businessName ?? '(not set)'}
type:          ${lead.businessType}
language:      ${lead.language}
phone:         ${lead.contact}
email:         ${lead.email ?? ''}
address:       ${lead.address ?? ''}
workingHours:  ${lead.workingHours ?? ''}
instagram:     ${lead.socialInstagram ?? ''}
facebook:      ${lead.socialFacebook ?? ''}
wishes:        ${lead.wishes ?? ''}

Services from brief:
${servicesList}

Photo URLs for IMAGES.gallery:
${photoList}

=== RULES ===
- Output ONLY raw TypeScript — no markdown, no code fences, no explanations
- Start with the import block exactly as in the template
- ALL visible text (labels, descriptions, reviews, FAQ, chat) MUST be in language "${lead.language}"
- IMAGES.hero and IMAGES.about: use a relevant Unsplash URL for "${lead.businessType}" (unless photos provided)
- IMAGES.gallery: use provided photo URLs; if none, use 5 Unsplash placeholders for "${lead.businessType}"
- SERVICE_CATEGORIES: fill from brief services above; if none, generate 2-3 realistic categories for "${lead.businessType}"
- CONTACT_ITEMS: use real address/phone/email/hours from business data; leave lines empty ('') if not provided
- REVIEWS: 4 realistic placeholder reviews in language "${lead.language}"
- FAQ_ITEMS: 5 relevant questions for "${lead.businessType}" in language "${lead.language}"
- CHAT_CONFIG: greeting + 4 quick replies in language "${lead.language}"
- Keep USE_LOCAL_IMAGES = false
- Keep SCHEDULE and MENU_CATEGORIES present in file (they are used depending on templateType)
- APOSTROPHES: any apostrophe inside a single-quoted string MUST be escaped as \\' — e.g. об\\'єму, зв\\'язок

=== FEW-SHOT EXAMPLE (food, Ukrainian) ===
import type {
  NavItem, StatItem, WhyItem, GalleryImage, Review,
  ContactItem, FaqItem, ChatConfig, ServiceCategory,
  DaySchedule, MenuCategory, ImageMap,
} from './types';

export const USE_LOCAL_IMAGES = false;

export const IMAGES: ImageMap = {
  hero: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80',
  about: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
  ],
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Головна',   href: '#hero'     },
  { label: 'Меню',      href: '#services' },
  { label: 'Відгуки',   href: '#reviews'  },
  { label: 'Контакти',  href: '#contact'  },
];

=== END OF EXAMPLE ===

Now generate the COMPLETE constants.ts for the business above. Output raw TypeScript only, starting from the import block.`;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateConstantsTs(
  lead: LeadConstantsInput,
  templateConstants: string,
): Promise<string | null> {
  const client = new Anthropic();

  let rawText: string;
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: buildPrompt(lead, templateConstants) }],
    });

    const firstContent = response.content[0];
    if (firstContent.type !== 'text') {
      console.error('[generate-constants] Unexpected response type:', firstContent.type);
      return null;
    }
    rawText = firstContent.text;
  } catch (err) {
    console.error('[generate-constants] Anthropic API error:', err instanceof Error ? err.message : err);
    return null;
  }

  console.log('[generate-constants] Raw response (first 400 chars):', rawText.substring(0, 400));

  const extracted = extractConstantsCode(rawText);
  if (!extracted) {
    console.error('[generate-constants] Could not extract TypeScript. Full response:', rawText);
    return null;
  }

  // Always guarantee the import block is present
  const code = ensureImports(extracted);

  // Basic validation — ensure required exports are present
  const required = ['SERVICE_CATEGORIES', 'NAV_ITEMS', 'REVIEWS', 'FAQ_ITEMS'];
  const missing  = required.filter((key) => !code.includes(key));
  if (missing.length > 0) {
    console.error('[generate-constants] Missing required exports:', missing.join(', '));
    console.error('[generate-constants] Generated code (first 500 chars):', code.substring(0, 500));
    return null;
  }

  console.log('[generate-constants] Success — code length:', code.length);
  return code;
}
