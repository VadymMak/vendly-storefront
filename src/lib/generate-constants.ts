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

/**
 * Post-process Claude output to fix common structural mistakes:
 * 1. ServiceCategory: rename 'title:' → 'name:' (only in SERVICE_CATEGORIES block)
 * 2. ServiceCategory: remove extra 'description:' from category level
 * 3. ServiceItem: add missing 'description' and 'icon' fields
 * 4. Review: add missing 'initial' and 'detail' fields, remove spurious 'date'
 */
function ensureServiceFields(code: string): string {
  let result = code;

  // ── 1. ServiceCategory: fix 'title:' → 'name:' inside SERVICE_CATEGORIES block ──
  // Strategy: find the SERVICE_CATEGORIES = [...] block and rename title→name within it
  result = result.replace(
    /(export const SERVICE_CATEGORIES[\s\S]*?)(?=export const \w|$)/,
    (block) => block.replace(/\btitle:\s*(?=['"])/g, 'name: '),
  );

  // ── 2. ServiceCategory: remove 'description:' line at category level ──
  // Category-level description sits between {id/name} and {items:} — detect by pattern:
  // lines of form `    description: '...',` that appear inside a category block before items:
  result = result.replace(
    /(export const SERVICE_CATEGORIES[\s\S]*?)(?=export const \w|$)/,
    (block) =>
      // Remove description lines that are directly inside category objects (before items:)
      block.replace(
        /(\{\s*\n\s+id:\s*'[^']*',\s*\n\s+(?:name|title):\s*'[^']*',\s*\n)\s+description:\s*'[^']*',\s*\n(\s+items:)/g,
        '$1$2',
      ),
  );

  // ── 3. ServiceItem: add missing 'description' before 'price' ──
  // Target: objects with price: but without description: (ServiceItem shape)
  result = result.replace(
    /(\{\s*id:\s*'[^']*',\s*name:\s*'(?:[^'\\]|\\.)*',\s*)(price:\s*')/g,
    (match, prefix, price) => `${prefix}description: '', ${price}`,
  );

  // ── 4. ServiceItem: add missing 'icon' after 'price' ──
  result = result.replace(
    /(description:\s*'(?:[^'\\]|\\.)*',\s*price:\s*'(?:[^'\\]|\\.)*',?\s*)(\})/g,
    (match, content, closing) => {
      if (match.includes('icon:')) return match;
      return `${content.trimEnd()}, icon: '💼' ${closing}`;
    },
  );

  // ── 5. Review: add missing 'initial' after 'name' ──
  result = result.replace(
    /(\{\s*\n?\s*id:\s*'([^']*)',\s*\n?\s*name:\s*'([^']*)',\s*\n?\s*)(text:|rating:)/g,
    (match, prefix, _id, name, next) => {
      const initial = name.trim().charAt(0) || 'X';
      return `${prefix}initial: '${initial}',\n    ${next}`;
    },
  );

  // ── 6. Review: add missing 'detail' before closing brace ──
  result = result.replace(
    /(rating:\s*\d+,?\s*\n?\s*)(\},)/g,
    (match, ratingLine, closing) => {
      if (match.includes('detail:')) return match;
      return `${ratingLine}detail: '',\n  ${closing}`;
    },
  );

  // ── 7. Review: remove 'date:' field (not in Review type) ──
  result = result.replace(/\s*date:\s*'[^']*',?\s*\n/g, '\n');

  return result;
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

⚠️ CRITICAL — EXACT FIELD NAMES (wrong fields = TypeScript build error):

ServiceCategory → EXACTLY 3 fields: id, name, items
  CORRECT: { id: '1', name: 'Category', items: [...] }
  WRONG:   { id: '1', title: 'Category', description: '...', items: [...] }
  → Use 'name' NOT 'title'. NO 'description' on the category itself.

ServiceItem → EXACTLY 5 fields: id, name, description, price, icon
  CORRECT: { id: '1-1', name: 'Service', description: 'Short desc', price: '50€', icon: '⭐' }
  WRONG:   { id: '1-1', name: 'Service', price: '50€' }
  → ALL 5 fields REQUIRED. Missing ANY field = build failure.

Review → EXACTLY 6 fields: id, name, initial, text, rating, detail
  CORRECT: { id: '1', name: 'Jan Novák', initial: 'J', text: 'Great!', rating: 5, detail: 'Regular customer' }
  WRONG:   { id: '1', name: 'Jan Novák', text: 'Great!', rating: 5 }
  → 'initial' = first letter of name. 'detail' = short context. NO 'date' field.

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
  { label: 'Головна',  href: '#hero'     },
  { label: 'Меню',     href: '#services' },
  { label: 'Відгуки',  href: '#reviews'  },
  { label: 'Контакти', href: '#contact'  },
];

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: '1',
    name: 'Основні страви',
    items: [
      { id: '1-1', name: 'Борщ',     description: 'Традиційний борщ',    price: '80 грн', icon: '🍲' },
      { id: '1-2', name: 'Вареники', description: 'З картоплею і грибами', price: '90 грн', icon: '🥟' },
    ],
  },
];

export const REVIEWS: Review[] = [
  {
    id: '1',
    name: 'Олена Мельник',
    initial: 'О',
    text: 'Смачна їжа, швидке обслуговування. Рекомендую!',
    rating: 5,
    detail: 'Постійний клієнт',
  },
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
  const withImports = ensureImports(extracted);

  // Fix common structural mistakes (ServiceItem fields, Review fields, title→name)
  const code = ensureServiceFields(withImports);

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
