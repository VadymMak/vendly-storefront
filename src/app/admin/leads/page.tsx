'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  contactName:     string | null;
  businessName:    string | null;
  businessType:    string;
  contact:         string;
  email:           string | null;
  language:        string;
  services:        string;
  siteUrl:         string | null;
  githubRepo:      string | null;
  vercelProject:   string | null;
  customDomain:    string | null;
  templateUsed:    string | null;
  demoUrl:         string | null;
  status:          string;
  package:         string | null;
  priceOneTime:    number | null;
  priceMonthly:    number | null;
  paidOneTime:     boolean;
  paidOneTimeDate: string | null;
  nextPaymentDate: string | null;
  // Brief fields
  address:          string | null;
  workingHours:     string | null;
  socialInstagram:  string | null;
  socialFacebook:   string | null;
  referenceUrl:     string | null;
  wishes:           string | null;
  priceListUrl:     string | null;
  logoUrl:          string | null;
  photoUrls:        string | null; // JSON string
  selectedPalette:   string | null;
  selectedHero:      string | null;
  selectedMood:      string | null;
  briefServicesJson: string | null;
  briefSubmitted:    boolean;
  briefSubmittedAt: string | null;
  notes:           string | null;
  // /create wizard fields
  description:   string | null;
  plan:          string | null;
  heroPhotoUrl:  string | null;
  galleryUrls:   string[];
  // Site Automation
  siteRepoUrl:     string | null;
  siteRepoName:    string | null;
  siteVercelUrl:   string | null;
  siteStatus:      string | null;
  siteError:       string | null;
  siteCreatedAt:   string | null;
  siteQaReport:    string | null;
  heroImageIndex:  number | null;
  createdAt:       string;
  updatedAt:       string;
}

type EditMap = Record<string, Partial<Lead>>;

interface QaDetails {
  heroReadable: boolean;
  navigationVisible: boolean;
  colorsConsistent: boolean;
  layoutCorrect: boolean;
  fontsLoaded: boolean;
}

interface QaReport {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
  details: QaDetails;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CYCLE = ['new', 'in_progress', 'site_ready', 'sent', 'paid', 'active', 'blocked', 'deleted'] as const;
type Status = typeof STATUS_CYCLE[number];

const STATUS_META: Record<string, { label: string; bg: string }> = {
  new:         { label: 'New',         bg: 'bg-yellow-500' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-500' },
  site_ready:  { label: 'Site Ready',  bg: 'bg-purple-500' },
  sent:        { label: 'Sent',        bg: 'bg-orange-500' },
  paid:        { label: 'Paid',        bg: 'bg-green-500' },
  active:      { label: 'Active',      bg: 'bg-emerald-400' },
  blocked:     { label: 'Blocked',     bg: 'bg-red-500' },
  deleted:     { label: 'Deleted',     bg: 'bg-gray-500' },
};

const FILTER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'new',         label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'site_ready',  label: 'Site Ready' },
  { key: 'sent',        label: 'Sent' },
  { key: 'paid',        label: 'Paid' },
  { key: 'active',      label: 'Active' },
  { key: 'blocked',     label: 'Blocked' },
];

const PACKAGE_OPTIONS = [
  { value: '',           label: '— не выбран —' },
  { value: 'landing',    label: 'Landing (€249)' },
  { value: 'premium',    label: 'Premium (€399)' },
  { value: 'individual', label: 'Individual (€799)' },
];

const BUSINESS_TYPE_OPTIONS = [
  'food', 'restaurant', 'beauty', 'repair', 'services',
  'home_services', 'digital', 'education', 'health', 'physical', 'ecommerce',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function waLink(contact: string): string {
  const digits = contact.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

// ─── UI primitives ────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2 text-sm text-white outline-none focus:border-[#6366F1] transition-colors placeholder:text-gray-500';
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function getTemplateType(businessType: string): string {
  if (['restaurant', 'bar'].includes(businessType)) return 'menu';
  if (['fitness', 'yoga'].includes(businessType)) return 'schedule';
  if (businessType === 'photography') return 'portfolio';
  return 'services';
}

function getHeadingFont(businessType: string): string {
  if (['beauty', 'medical'].includes(businessType)) return 'playfair';
  if (['auto', 'repair'].includes(businessType)) return 'oswald';
  if (['bar', 'restaurant'].includes(businessType)) return 'cormorant';
  return 'inter';
}

// Maps brief palette IDs (dark/light/warm/professional/natural/custom)
// to template palette presets (dark-premium/clean-light/warm-cozy/...).
// For businessType 'medical' we force 'medical' palette regardless.
function mapPalette(briefPalette: string | null, businessType: string): string {
  if (businessType === 'medical') return 'medical';
  switch (briefPalette) {
    case 'dark':         return 'dark-premium';
    case 'light':        return 'clean-light';
    case 'warm':         return 'warm-cozy';
    case 'professional': return 'professional';
    case 'natural':      return 'natural';
    case 'custom':       return 'professional';
    default:             return 'professional';
  }
}

// Language-aware taglines. Falls back to English for unknown languages.
function getTagline(businessType: string, language: string): string {
  const map: Record<string, Record<string, string>> = {
    sk: {
      auto:         'Profesionálny autoservis',
      beauty:       'Salón krásy',
      restaurant:   'Reštaurácia & Café',
      medical:      'Zdravotnícka klinika',
      fitness:      'Fitness & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Profesionálna fotografia',
      ecommerce:    'Online obchod',
      other:        'Profesionálne služby',
    },
    en: {
      auto:         'Professional Auto Service',
      beauty:       'Beauty Salon',
      restaurant:   'Restaurant & Café',
      medical:      'Medical Clinic',
      fitness:      'Fitness & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Professional Photography',
      ecommerce:    'Online Shop',
      other:        'Professional Services',
    },
    ru: {
      auto:         'Профессиональный автосервис',
      beauty:       'Салон красоты',
      restaurant:   'Ресторан & Кафе',
      medical:      'Медицинская клиника',
      fitness:      'Фитнес & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Профессиональная фотография',
      ecommerce:    'Интернет-магазин',
      other:        'Профессиональные услуги',
    },
    uk: {
      auto:         'Професійний автосервіс',
      beauty:       'Салон краси',
      restaurant:   'Ресторан & Кафе',
      medical:      'Медична клініка',
      fitness:      'Фітнес & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Професійна фотографія',
      ecommerce:    'Інтернет-магазин',
      other:        'Професійні послуги',
    },
    de: {
      auto:         'Professionelle Autowerkstatt',
      beauty:       'Schönheitssalon',
      restaurant:   'Restaurant & Café',
      medical:      'Medizinische Klinik',
      fitness:      'Fitness & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Professionelle Fotografie',
      ecommerce:    'Online-Shop',
      other:        'Professionelle Dienstleistungen',
    },
    cs: {
      auto:         'Profesionální autoservis',
      beauty:       'Salon krásy',
      restaurant:   'Restaurace & Café',
      medical:      'Zdravotnická klinika',
      fitness:      'Fitness & Wellness',
      bar:          'Premium Lounge Bar',
      photography:  'Profesionální fotografie',
      ecommerce:    'Internetový obchod',
      other:        'Profesionální služby',
    },
  };
  const langMap = map[language] ?? map.en;
  return langMap[businessType] ?? langMap.other;
}

function parsePhotos(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch { return []; }
}

function extractRepoName(githubUrl: string | null): string {
  if (!githubUrl) return '';
  const parts = githubUrl.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] ?? '';
}

// Strips emojis, variation selectors and ZWJs from user input.
// Emoji come from onboarding chat button labels (✂️ Стрижки) and are NOT services.
function stripEmojis(str: string): string {
  return str.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').trim();
}

// Currency label per language — based on our target markets (SK/CZ/UA/DE).
function getCurrency(language: string): string {
  switch (language) {
    case 'uk': return 'грн (UAH)';
    case 'sk': return '€ (EUR)';
    case 'cs': return 'Kč (CZK)';
    case 'de': return '€ (EUR)';
    case 'ru': return 'грн (UAH) если клиент из Украины, иначе € (EUR)';
    case 'en':
    default:   return '€ (EUR)';
  }
}

// Concrete mood description — replaces vague "cozy" with actionable adjectives.
// Per language so VSCode Claude writes copy directly in that language.
function getMoodDescription(mood: string, language: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    cozy: {
      ru: 'тёплый, дружелюбный, уютный, персональный — используй эмоциональные слова, обращайся к клиенту на "ты" или мягко на "вы", как к другу',
      uk: 'теплий, дружній, затишний, персональний — використовуй емоційні слова, звертайся до клієнта по-дружньому',
      sk: 'teplý, priateľský, útulný, osobný — používaj emocionálne slová, oslovuj klienta ako priateľa',
      en: 'warm, friendly, cozy, personal — use emotional language, address client as a friend',
      de: 'warm, freundlich, gemütlich, persönlich — verwende emotionale Sprache',
      cs: 'teplý, přátelský, útulný, osobní — používej emocionální slova',
    },
    modern: {
      ru: 'минималистичный, профессиональный, краткий — факты и конкретика без лишних эмоций, обращение на "вы"',
      uk: 'мінімалістичний, професійний, стислий — факти без зайвих емоцій',
      sk: 'minimalistický, profesionálny, stručný — fakty bez emócií',
      en: 'minimalistic, professional, concise — facts and specifics, no fluff',
      de: 'minimalistisch, professionell, präzise — Fakten ohne Emotionen',
      cs: 'minimalistický, profesionální, stručný — fakta bez emocí',
    },
    strict: {
      ru: 'формальный, деловой, уважительный тон — обращение только на "Вы", корпоративная стилистика',
      uk: 'формальний, діловий, шанобливий тон — тільки на "Ви"',
      sk: 'formálny, obchodný, zdvorilý tón — výhradne vykanie',
      en: 'formal, business-like, respectful tone — corporate style',
      de: 'formell, geschäftlich, respektvoll — Siezen',
      cs: 'formální, obchodní, zdvořilý tón — výhradně vykání',
    },
  };
  return descriptions[mood]?.[language] ?? descriptions[mood]?.en ?? 'professional tone';
}

// Cleans onboarding chat selections: strips emojis, removes items that are
// clearly UI buttons not services (Прайс, Запис, Price, Booking).
function cleanChatServices(raw: string | null): string[] {
  if (!raw) return [];
  const junk = /^(прайс|прайс-лист|запис|запись|price|prices|pricing|booking|záznam|cennik|cennik|rezervácia|termin|termín)$/i;
  return raw
    .split(/[,\n]+/)
    .map((s) => stripEmojis(s))
    .filter((s) => s.length > 0 && !junk.test(s));
}

// Parse structured services submitted in the brief form (JSON array).
// Returns [] if missing or malformed.
interface ParsedBriefService {
  name: string; price: string; duration: string; note: string;
}
function parseBriefServices(raw: string | null): ParsedBriefService[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<{ name?: string; price?: string; duration?: string; note?: string }>;
    return arr
      .filter((s) => s && typeof s.name === 'string' && s.name.trim())
      .map((s) => ({
        name:     (s.name ?? '').trim(),
        price:    (s.price ?? '').trim(),
        duration: (s.duration ?? '').trim(),
        note:     (s.note ?? '').trim(),
      }));
  } catch {
    return [];
  }
}

// Format a structured service into a single readable line for the prompt.
function formatBriefServiceLine(s: ParsedBriefService, currency: string): string {
  const currencySymbol = currency.split(' ')[0];
  const parts: string[] = [s.name];
  if (s.price)    parts.push(`${s.price} ${currencySymbol}`);
  if (s.duration) parts.push(s.duration);
  if (s.note)     parts.push(`(${s.note})`);
  return parts.join(' — ');
}

function buildPrompt(lead: Lead, repoName: string): string {
  // ── Derived values ─────────────────────────────────────────────────────────
  const phone        = (lead.contact ?? '').replace(/[\s+\-()]/g, '');
  const templateType = getTemplateType(lead.businessType);
  const palette      = mapPalette(lead.selectedPalette, lead.businessType);
  const tagline      = getTagline(lead.businessType, lead.language);
  const headingFont  = getHeadingFont(lead.businessType);
  const businessName = lead.businessName ?? 'Business Name';
  const name         = repoName || '{repoName}';
  const isEcommerce  = lead.businessType === 'ecommerce';
  const mood         = lead.selectedMood ?? 'modern';
  const moodDesc     = getMoodDescription(mood, lead.language);
  const currency     = getCurrency(lead.language);

  // ── Services — PRIMARY: brief form (structured with prices), FALLBACK: chat
  const briefServices = parseBriefServices(lead.briefServicesJson);
  const chatServices  = cleanChatServices(lead.services);

  let services: string[];
  let servicesSource: string;
  if (briefServices.length > 0) {
    services = briefServices.map((s) => formatBriefServiceLine(s, currency));
    servicesSource = 'бриф-форма (СТРУКТУРИРОВАННО: название + цена + длительность + примечание)';
  } else {
    services = chatServices;
    servicesSource = 'онбординг-чат (эмодзи убраны, UI-кнопки отфильтрованы)';
  }

  const servicesList = services.length
    ? services.map((s) => `  - ${s}`).join('\n')
    : '  (клиент не заполнил услуги — извлеки из wishes или спроси в чате)';

  // ── Photos + logo ──────────────────────────────────────────────────────────
  const photos   = parsePhotos(lead.photoUrls);
  const photosBlock = photos.length
    ? photos.map((url, i) => `  ${i + 1}. ${url}`).join('\n')
    : '  (клиент не загрузил фото — используй Unsplash URLs по нише, с фильтром по полу/возрасту клиентуры)';
  const logoBlock = lead.logoUrl
    ? `LOGO_URL: ${lead.logoUrl}`
    : 'LOGO: клиент не загрузил — используй текстовый логотип (businessName) в шрифте headingFont';

  // ── Name/tagline language check ────────────────────────────────────────────
  // Detect obvious language mismatch (Cyrillic name on Latin-only language etc.)
  const nameIsCyrillic    = /[А-ЯЁІЇЄҐа-яёіїєґ]/.test(businessName);
  const langUsesCyrillic  = ['uk', 'ru'].includes(lead.language);
  const langUsesLatin     = ['sk', 'cs', 'en', 'de'].includes(lead.language);
  const nameMismatchWarn  =
    (nameIsCyrillic && langUsesLatin) || (!nameIsCyrillic && langUsesCyrillic && businessName !== 'Business Name')
      ? `\n⚠️ ВНИМАНИЕ: businessName "${businessName}" написано в алфавите, отличном от language="${lead.language}". Если клиент не уточнил — оставь как есть (это официальное название бренда). НЕ переводи без уверенности.`
      : '';

  // ── Handle ecommerce separately ────────────────────────────────────────────
  if (isEcommerce) {
    return `# VendShop E-COMMERCE: ${businessName}
# ⚠️ Шаблон: vendshop-ecommerce (НЕ vendshop-template)
# Клиент: ${lead.contact} | Язык: ${lead.language} | Валюта: ${currency}
# Lead ID: ${lead.id}${nameMismatchWarn}

## STEP 0 — Жёсткие правила

### Что делать
1. Клонировать vendshop-ecommerce через GitHub "Use this template" → имя: ${name}
2. Вызвать build_context_for_query (multi-ai-chat MCP): "vendshop ecommerce customization ${lead.businessType}"
3. Редактировать ТОЛЬКО: lib/config.ts, lib/constants.ts, lib/ui-translations.ts

### Что НЕ делать
- НЕ трогать компоненты, страницы, корзину, чекаут — архитектура уже работает
- НЕ переписывать существующие переводы в ui-translations.ts — только ДОБАВЛЯЙ недостающие ключи
- НЕ придумывать товары — используй ТОЛЬКО то что указано ниже
- НЕ копировать цвета/шрифты/структуру с Reference URL — только идею настроения

## STEP 1 — lib/config.ts
name:           '${businessName}'
tagline:        '${tagline}'
palette:        '${palette}'
language:       '${lead.language}'
currency:       '${currency.split(' ')[0]}'
whatsappNumber: '+${phone}'
contactEmail:   '${lead.email ?? ''}'
address:        '${lead.address ?? ''}'
workingHours:   '${lead.workingHours ?? ''}'
socialInstagram:'${lead.socialInstagram ?? ''}'
socialFacebook: '${lead.socialFacebook ?? ''}'
useLocalImages: false

## STEP 2 — PRODUCTS (из онбординга)
${servicesList}

## STEP 3 — Цены и дополнения (сырой текст от клиента)
${lead.wishes ?? '(клиент не оставил пожеланий)'}

Распарси: прайс (${currency}) → привяжи к товарам; feature-пожелания ("онлайн оплата", "доставка") → в FAQ или /about.

## STEP 4 — Brand assets
${logoBlock}
PHOTOS (${photos.length}):
${photosBlock}
Price list: ${lead.priceListUrl ?? 'нет'}

## STEP 5 — Deploy
npx tsc --noEmit && pnpm build
git remote add origin https://github.com/VadymMak/${name}.git
git push -u origin main
Vercel → subdomain: ${name}.vendshop.shop`;
  }

  // ── Regular template (landing) ─────────────────────────────────────────────
  return `# VendShop Landing: ${businessName}
# Шаблон: vendshop-template (templateType: ${templateType})
# Клиент: ${lead.contact} | Язык: ${lead.language} | Валюта: ${currency}
# Lead ID: ${lead.id}${nameMismatchWarn}

## STEP 0 — Жёсткие правила (прочти первым, следуй строго)

### ✅ ЧТО ДЕЛАТЬ
1. Клонировать vendshop-template через GitHub "Use this template" → имя репо: ${name}
2. Вызвать build_context_for_query (multi-ai-chat MCP) с query:
   "vendshop template customization ${lead.businessType} ${lead.language}"
3. Читать и редактировать ТОЛЬКО три файла:
   - lib/config.ts  (палитра, язык, tagline, контакты, hero, mood)
   - lib/constants.ts  (SERVICES array, GALLERY_IMAGES, BUSINESS_INFO)
   - lib/ui-translations.ts  (убедись что ключи языка "${lead.language}" есть — ДОБАВЛЯЙ недостающие, НЕ переписывай существующие)

### ❌ ЧТО НЕ ДЕЛАТЬ
- НЕ читать и НЕ менять компоненты/страницы/анимации — всё уже работает
- НЕ переписывать уже существующие переводы в ui-translations.ts
- НЕ придумывать услуги — используй ТОЛЬКО список из STEP 2
- НЕ добавлять эмодзи в названия услуг (они были в онбординге только как иконки кнопок)
- НЕ копировать с Reference URL цвета, шрифты, структуру — бери ТОЛЬКО общее настроение
- НЕ менять цвета палитры вручную — использовать \`palette: '${palette}'\` и всё

### 📏 ПРАВИЛА КАЧЕСТВА
- Все UI-тексты через t() из ui-translations.ts — НИКАКОГО хардкода словацкого/английского
- Все тексты сайта (SERVICES.description, ABOUT, FAQ, CTA) на языке "${lead.language}"
- Валюта для цен: ${currency}
- Mood: ${mood} — копирайтинг должен быть ${moodDesc}

## STEP 1 — lib/config.ts
export const SITE_CONFIG: SiteConfig = {
  name:           '${businessName}',
  tagline:        '${tagline}',
  templateType:   '${templateType}',
  palette:        '${palette}',              // пресет, цвета уже правильные
  language:       '${lead.language}',        // основной язык сайта
  headingFont:    '${headingFont}',
  whatsappNumber: '+${phone}',
  contactEmail:   '${lead.email ?? ''}',
  address:        '${lead.address ?? ''}',
  workingHours:   '${lead.workingHours ?? 'По договоренности'}',
  socialInstagram:'${lead.socialInstagram ?? ''}',
  socialFacebook: '${lead.socialFacebook ?? ''}',
  heroStyle:      '${lead.selectedHero ?? 'fullscreen'}',  // fullscreen | split | centered
  mood:           '${mood}',                               // ${mood} = ${moodDesc.split(' — ')[0]}
  useLocalImages: false,
};

## STEP 2 — lib/constants.ts

### SERVICES — источник: ${servicesSource}
Используй ЭТИ названия дословно (переведи на ${lead.language} если нужно):
${servicesList}

Структура каждого элемента массива:
{
  name:        '...' на ${lead.language},
  description: '...' 1-2 предложения, тон: ${mood},
  price:       '... ${currency.split(' ')[0]}'${briefServices.length > 0 ? ' (уже указана клиентом — НЕ меняй)' : ' (извлеки из STEP 3)'},
  duration:    '...' если применимо${briefServices.length > 0 ? ' (уже указана клиентом)' : ''},
}

### GALLERY_IMAGES — используй ВСЕ ${photos.length} фото
${photosBlock}

### BUSINESS_INFO
${logoBlock}
Price list: ${lead.priceListUrl ?? '(нет)'}

## STEP 3 — Сырой текст от клиента (wishes) — распарсить
\`\`\`
${lead.wishes ?? '(клиент не оставил пожеланий)'}
\`\`\`

Из этого текста извлеки:
1. **Цены** (${currency}) → прикрепи к соответствующим услугам из SERVICES
2. **Feature-пожелания** ("онлайн запись", "мультиязычность") → добавь в FAQ или секцию "Что мы предлагаем"
3. **Языковые пожелания** ("сайт на русском и английском") → это уже решено через language="${lead.language}", игнорируй или добавь пометку в FAQ

## STEP 4 — Настроение и референс

**Mood: ${mood}** → ${moodDesc}

**Reference: ${lead.referenceUrl ?? '(нет)'}**
Взять ТОЛЬКО: общее ощущение, структуру секций, идеи для CTA.
НЕ копировать: цвета, шрифты, конкретные тексты, картинки.

**Бизнес-тип: ${lead.businessType}** — учитывай целевую аудиторию при выборе tone of voice.

## STEP 5 — SEO (секция в app/layout.tsx — только metadata)
- title: "${businessName} — ${tagline}${lead.address ? ' | ' + lead.address.split(',')[0] : ''}"
- description: 1 предложение на ${lead.language} — кто мы, что делаем, где находимся
- openGraph: image = первое фото из GALLERY_IMAGES, locale = "${lead.language}"

## STEP 6 — Verify & deploy
1. npx tsc --noEmit  (должен пройти без ошибок)
2. pnpm lint  (без warnings)
3. pnpm build  (без ошибок)
4. git remote add origin https://github.com/VadymMak/${name}.git
5. git push -u origin main
6. Vercel deploy → добавить subdomain: ${name}.vendshop.shop (wildcard CNAME уже настроен)

## ⚠️ ЖЁСТКИЙ CHECKLIST — пройди перед пушем
- [ ] Все UI-тексты через t() — ни одной строки на словацком если language != 'sk'
- [ ] Существующие переводы в ui-translations.ts НЕ переписаны
- [ ] Палитра: только \`palette: '${palette}'\` — цвета руками НЕ трогал
- [ ] SERVICES: ${services.length > 0 ? services.length : 'N'} услуг, все названия без эмодзи
- [ ] Услуги НЕ придуманы — только из STEP 2
- [ ] Все ${photos.length} фото клиента использованы в GALLERY_IMAGES
- [ ] Логотип: ${lead.logoUrl ? 'подставлен из LOGO_URL' : 'текстовый (клиент не загрузил)'}
- [ ] Цены в ${currency} привязаны к услугам
- [ ] WhatsApp +${phone} кликабельный, ведёт на wa.me/${phone}
- [ ] SEO metadata заполнена на языке ${lead.language}
- [ ] Reference URL НЕ скопирован (цвета/шрифты/структура — свои)
- [ ] Сайт визуально проверен на mobile (шаблон responsive, но убедись)`;
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [draft, setDraft]     = useState<Partial<Lead>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [repoName, setRepoName]     = useState(() => extractRepoName(lead.githubRepo));
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptText, setPromptText]     = useState<string | null>(null);
  const [siteCreating, setSiteCreating] = useState(false);
  const [siteError, setSiteError]       = useState<string | null>(null);
  // Local optimistic overrides for site fields
  const [siteStatus, setSiteStatus]     = useState<string | null>(lead.siteStatus ?? 'none');
  const [siteRepoUrl, setSiteRepoUrl]   = useState<string | null>(lead.siteRepoUrl);
  const [siteRepoName, setSiteRepoName] = useState<string | null>(lead.siteRepoName);
  const [siteVercelUrl, setSiteVercelUrl] = useState<string | null>(lead.siteVercelUrl);
  const [qaRunning, setQaRunning]       = useState(false);
  const [siteQaReport, setSiteQaReport] = useState<string | null>(lead.siteQaReport);
  const [photos, setPhotos]             = useState<string[]>(() => {
    const briefPhotos  = parsePhotos(lead.photoUrls);
    const wizardPhotos = [
      ...(lead.heroPhotoUrl ? [lead.heroPhotoUrl] : []),
      ...(lead.logoUrl      ? [lead.logoUrl]      : []),
      ...(Array.isArray(lead.galleryUrls) ? lead.galleryUrls : []),
    ];
    const all = [...briefPhotos, ...wizardPhotos];
    return all.filter((url, i) => all.indexOf(url) === i); // deduplicate
  });
  const [heroIdx, setHeroIdx]           = useState<number>(lead.heroImageIndex ?? 0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Merge db values with draft for display
  const val = <K extends keyof Lead>(key: K): Lead[K] =>
    (key in draft ? draft[key] : lead[key]) as Lead[K];

  const set = (key: keyof Lead, value: unknown) =>
    setDraft((p) => ({ ...p, [key]: value }));

  async function save() {
    if (Object.keys(draft).length === 0) return;
    setSaving(true);
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: lead.id, ...draft }),
    });
    onUpdate(lead.id, draft);
    setDraft({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function cycleStatus() {
    const idx  = STATUS_CYCLE.indexOf(lead.status as Status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onUpdate(lead.id, { status: next });
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: lead.id, status: next }),
    });
  }

  async function softDelete() {
    await fetch('/api/admin/leads', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: lead.id }),
    });
    onDelete(lead.id);
  }

  async function createSite() {
    setSiteCreating(true);
    setSiteError(null);
    setSiteStatus('creating');
    try {
      const res = await fetch(`/api/leads/${lead.id}/create-site`, { method: 'POST' });
      const data = await res.json() as { success?: boolean; repoUrl?: string; vercelUrl?: string; error?: string };
      if (!res.ok) {
        const msg = data.error ?? `HTTP ${res.status}`;
        setSiteStatus('error');
        setSiteError(msg);
        onUpdate(lead.id, { siteStatus: 'error', siteError: msg });
      } else {
        const repoName = data.repoUrl ? (data.repoUrl.split('/').pop() ?? null) : null;
        setSiteStatus('created');
        setSiteRepoUrl(data.repoUrl ?? null);
        setSiteRepoName(repoName);
        setSiteVercelUrl(data.vercelUrl ?? null);
        onUpdate(lead.id, {
          siteStatus:    'created',
          siteRepoUrl:   data.repoUrl ?? null,
          siteRepoName:  repoName,
          siteVercelUrl: data.vercelUrl ?? null,
          siteError:     null,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setSiteStatus('error');
      setSiteError(msg);
      onUpdate(lead.id, { siteStatus: 'error', siteError: msg });
    } finally {
      setSiteCreating(false);
    }
  }

  async function uploadAdminPhoto(file: File) {
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch(`/api/admin/leads/${lead.id}/upload-photo`, { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; photoUrls?: string; error?: string };
      if (res.ok && data.photoUrls) {
        const updated = parsePhotos(data.photoUrls);
        setPhotos(updated);
        onUpdate(lead.id, { photoUrls: data.photoUrls });
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveHeroIndex(idx: number) {
    setHeroIdx(idx);
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: lead.id, heroImageIndex: idx }),
    });
    onUpdate(lead.id, { heroImageIndex: idx });
  }

  async function runQa() {
    setQaRunning(true);
    try {
      const res  = await fetch(`/api/leads/${lead.id}/screenshot`, { method: 'POST' });
      const data = await res.json() as { success?: boolean; qaReport?: QaReport; error?: string };
      if (res.ok && data.qaReport) {
        const newStatus    = data.qaReport.passed ? 'qa_passed' : 'qa_failed';
        const reportString = JSON.stringify(data.qaReport);
        setSiteStatus(newStatus);
        setSiteQaReport(reportString);
        onUpdate(lead.id, { siteStatus: newStatus, siteQaReport: reportString });
      }
    } catch {
      // silent — API will return error JSON if something breaks
    } finally {
      setQaRunning(false);
    }
  }

  const meta = STATUS_META[lead.status] ?? STATUS_META.new;

  return (
    <div className="overflow-hidden rounded-xl border border-[#374151] bg-[#1E293B]">
      {/* ── Summary row ── */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#263349] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Status badge */}
        <button
          onClick={(e) => { e.stopPropagation(); void cycleStatus(); }}
          title="Click to cycle status"
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-80 ${meta.bg}`}
        >
          {meta.label}
        </button>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">
              {lead.businessName || lead.contactName || lead.contact}
            </span>
            <span className="rounded bg-[#334155] px-1.5 py-0.5 text-xs text-gray-300">
              {lead.businessType}
            </span>
            {(lead.package || lead.plan) && (
              <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-xs text-indigo-300 capitalize">
                {lead.package || lead.plan}
              </span>
            )}
            <span className="text-xs text-gray-500">{lead.language.toUpperCase()}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-400">{lead.contact}</p>
        </div>

        {/* Right info */}
        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-400">
          {lead.paidOneTime && (
            <span className="rounded bg-green-900/50 px-2 py-0.5 text-green-400 font-medium">✓ Paid</span>
          )}
          {lead.priceOneTime && (
            <span className="text-gray-300">€{lead.priceOneTime}</span>
          )}
          <span className="hidden sm:block">
            {new Date(lead.createdAt).toLocaleDateString('sk')}
          </span>
          <span className="text-gray-500">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded ── */}
      {open && (
        <div className="border-t border-[#374151] px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">

            {/* ── Left: Contact info ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Контакт</p>

              <Field label="Имя контакта">
                <input type="text" className={inputCls} value={val('contactName') ?? ''}
                  placeholder="Иван Новак"
                  onChange={(e) => set('contactName', e.target.value)} />
              </Field>

              <Field label="Название бизнеса">
                <input type="text" className={inputCls} value={val('businessName') ?? ''}
                  placeholder="Café Merkur"
                  onChange={(e) => set('businessName', e.target.value)} />
              </Field>

              <Field label="Тип бизнеса">
                <select
                  className={inputCls}
                  value={val('businessType') as string}
                  onChange={(e) => set('businessType', e.target.value)}
                >
                  {BUSINESS_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="Контакт">
                <div className="flex items-center gap-2">
                  <p className="flex-1 rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2 text-sm text-gray-300 truncate">
                    {lead.contact}
                  </p>
                  <a
                    href={waLink(lead.contact)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-lg bg-green-700 px-2.5 py-2 text-xs font-medium text-white hover:bg-green-600"
                  >
                    WA
                  </a>
                </div>
              </Field>

              <Field label="Email">
                <input type="email" className={inputCls} value={val('email') ?? ''}
                  placeholder="hello@business.sk"
                  onChange={(e) => set('email', e.target.value)} />
              </Field>

              <Field label="Язык">
                <p className="text-sm text-gray-400">{lead.language.toUpperCase()}</p>
              </Field>

              <Field label={lead.description ? 'Описание' : 'Услуги'}>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {lead.description || lead.services || '—'}
                </p>
              </Field>

              {lead.demoUrl && (
                <Field label="Показан демо">
                  <a href={lead.demoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:underline break-all">
                    {lead.demoUrl}
                  </a>
                </Field>
              )}
            </div>

            {/* ── Right: Site & Finance ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Сайт и финансы</p>

              <Field label="URL сайта">
                <div className="flex items-center gap-2">
                  <input type="url" className={inputCls} value={val('siteUrl') ?? ''}
                    placeholder="https://..."
                    onChange={(e) => set('siteUrl', e.target.value)} />
                  {(val('siteUrl') ?? lead.siteUrl) && (
                    <a
                      href={val('siteUrl') as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-lg border border-[#374151] px-2.5 py-2 text-xs text-gray-300 hover:bg-[#334155]"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </Field>

              <Field label="GitHub Repo">
                <div className="flex items-center gap-2">
                  <input type="url" className={inputCls} value={val('githubRepo') ?? ''}
                    placeholder="https://github.com/..."
                    onChange={(e) => {
                      set('githubRepo', e.target.value);
                      setRepoName(extractRepoName(e.target.value));
                    }} />
                  {(val('githubRepo') ?? lead.githubRepo) && (
                    <a
                      href={val('githubRepo') as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-lg border border-[#374151] px-2.5 py-2 text-xs text-gray-300 hover:bg-[#334155]"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </Field>

              <Field label="Repo name (для промпта)">
                <input
                  type="text"
                  className={inputCls}
                  value={repoName}
                  placeholder="vendly-cafe-merkur"
                  onChange={(e) => setRepoName(e.target.value)}
                />
              </Field>

              <Field label="Custom Domain">
                <input type="text" className={inputCls} value={val('customDomain') ?? ''}
                  placeholder="mycafe.sk"
                  onChange={(e) => set('customDomain', e.target.value)} />
              </Field>

              {lead.plan && (
                <Field label="Тариф /create">
                  <p className="rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2 text-sm text-indigo-300 font-medium">
                    {lead.plan}
                  </p>
                </Field>
              )}

              <Field label="Пакет">
                <select
                  className={inputCls}
                  value={val('package') ?? ''}
                  onChange={(e) => set('package', e.target.value || null)}
                >
                  {PACKAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Цена разово (€)">
                  <input type="number" className={inputCls} value={val('priceOneTime') ?? ''}
                    placeholder="249"
                    onChange={(e) => set('priceOneTime', e.target.value ? parseFloat(e.target.value) : null)} />
                </Field>
                <Field label="Цена / мес (€)">
                  <input type="number" className={inputCls} value={val('priceMonthly') ?? ''}
                    placeholder="29"
                    onChange={(e) => set('priceMonthly', e.target.value ? parseFloat(e.target.value) : null)} />
                </Field>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`paid-${lead.id}`}
                  checked={val('paidOneTime') as boolean}
                  onChange={(e) => set('paidOneTime', e.target.checked)}
                  className="h-4 w-4 accent-green-500"
                />
                <label htmlFor={`paid-${lead.id}`} className="text-sm text-gray-300 cursor-pointer">
                  Разовая оплата получена
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Дата оплаты">
                  <input type="date" className={inputCls}
                    value={toDateInputValue(val('paidOneTimeDate') as string | null)}
                    onChange={(e) => set('paidOneTimeDate', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </Field>
                <Field label="След. платёж">
                  <input type="date" className={inputCls}
                    value={toDateInputValue(val('nextPaymentDate') as string | null)}
                    onChange={(e) => set('nextPaymentDate', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </Field>
              </div>
            </div>

            {/* ── Notes (full width) ── */}
            <div className="sm:col-span-2">
              <Field label="Заметки">
                <textarea
                  rows={4}
                  className={`${inputCls} resize-none`}
                  value={val('notes') as string ?? ''}
                  placeholder="Заметки о клиенте, переговорах, договорённостях..."
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>

            {/* ── Brief section (full width) ── */}
            <div className="sm:col-span-2">
              <div className="rounded-xl border border-[#374151] bg-[#0B1120] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Бриф</p>
                  {lead.briefSubmitted ? (
                    <span className="rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-medium text-green-400">
                      ✅ Заполнен {lead.briefSubmittedAt ? new Date(lead.briefSubmittedAt).toLocaleDateString('sk') : ''}
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-900/40 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                      ⏳ Ожидает бриф
                    </span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => {
                        if (promptText !== null) {
                          setPromptText(null);
                          return;
                        }
                        setPromptText(buildPrompt({ ...lead, ...draft } as Lead, repoName));
                      }}
                      className="rounded-lg border border-cyan-800 bg-cyan-900/30 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-800/50 transition-colors"
                      title="Сгенерировать промпт для VSCode Claude"
                    >
                      {promptText !== null ? '✕ Закрыть' : '📋 Промпт'}
                    </button>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(`https://vendshop.shop/brief/${lead.id}`);
                      }}
                      className="rounded-lg border border-[#374151] px-2.5 py-1 text-xs text-gray-400 hover:bg-[#334155] transition-colors"
                      title="Скопировать ссылку на бриф"
                    >
                      🔗 Ссылка
                    </button>
                  </div>
                </div>

                {(lead.briefSubmitted || lead.description || lead.selectedPalette || lead.heroPhotoUrl || lead.galleryUrls?.length) ? (
                  <div className="space-y-3">
                    {/* /create wizard data */}
                    {lead.description && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">Описание бизнеса:</p>
                        <p className="rounded-lg bg-[#0F172A] px-3 py-2 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {lead.description}
                        </p>
                      </div>
                    )}
                    {lead.plan && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Тариф wizard:</span>
                        <span className="rounded bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300 font-medium">{lead.plan}</span>
                      </div>
                    )}

                    {/* Style badges */}
                    <div className="flex flex-wrap gap-2">
                      {lead.selectedPalette && (
                        <span className="rounded-lg bg-violet-900/50 px-2.5 py-1 text-xs font-medium text-violet-300 border border-violet-800/50">
                          🎨 {lead.selectedPalette}
                        </span>
                      )}
                      {lead.selectedHero && (
                        <span className="rounded-lg bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-300 border border-blue-800/50">
                          📐 {lead.selectedHero}
                        </span>
                      )}
                      {lead.selectedMood && (
                        <span className="rounded-lg bg-pink-900/50 px-2.5 py-1 text-xs font-medium text-pink-300 border border-pink-800/50">
                          💡 {lead.selectedMood}
                        </span>
                      )}
                    </div>

                    {/* Info grid */}
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      {lead.address && (
                        <div>
                          <span className="text-gray-500">Адрес: </span>
                          <span className="text-gray-300">{lead.address}</span>
                        </div>
                      )}
                      {lead.workingHours && (
                        <div>
                          <span className="text-gray-500">Часы: </span>
                          <span className="text-gray-300">{lead.workingHours}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div>
                          <span className="text-gray-500">Email: </span>
                          <span className="text-gray-300">{lead.email}</span>
                        </div>
                      )}
                      {lead.socialInstagram && (
                        <div>
                          <span className="text-gray-500">Instagram: </span>
                          <a href={`https://instagram.com/${lead.socialInstagram.replace('@','')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline">{lead.socialInstagram}</a>
                        </div>
                      )}
                      {lead.socialFacebook && (
                        <div>
                          <span className="text-gray-500">Facebook: </span>
                          <a href={lead.socialFacebook.startsWith('http') ? lead.socialFacebook : `https://${lead.socialFacebook}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline">{lead.socialFacebook}</a>
                        </div>
                      )}
                      {lead.referenceUrl && (
                        <div className="sm:col-span-2">
                          <span className="text-gray-500">Референс: </span>
                          <a href={lead.referenceUrl} target="_blank" rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline break-all">{lead.referenceUrl}</a>
                        </div>
                      )}
                    </div>

                    {/* Wishes */}
                    {lead.wishes && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">Пожелания:</p>
                        <p className="rounded-lg bg-[#0F172A] px-3 py-2 text-xs text-gray-300 leading-relaxed">
                          {lead.wishes}
                        </p>
                      </div>
                    )}

                    {/* Price list */}
                    {lead.priceListUrl && (
                      <div>
                        <a href={lead.priceListUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#374151] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#334155]">
                          📄 Открыть прайс
                        </a>
                      </div>
                    )}

                    {/* Logo */}
                    {lead.logoUrl && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">Логотип:</p>
                        <a href={lead.logoUrl} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={lead.logoUrl} alt="logo" className="h-16 w-16 rounded-lg object-contain bg-[#0F172A] p-1 border border-[#374151]" />
                        </a>
                      </div>
                    )}

                    {/* Photos — brief form (photoUrls) + wizard (heroPhotoUrl / galleryUrls) */}
                    {(() => {
                      const briefUrls = parsePhotos(lead.photoUrls);
                      const heroUrl   = lead.heroPhotoUrl;
                      const galleryUrls = Array.isArray(lead.galleryUrls) ? lead.galleryUrls : [];
                      const all = [...briefUrls, ...(heroUrl ? [heroUrl] : []), ...galleryUrls]
                        .filter((u, i, a) => a.indexOf(u) === i);
                      if (!all.length) return null;
                      return (
                        <div>
                          <p className="mb-1.5 text-xs text-gray-500">Фото ({all.length}):</p>
                          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                            {all.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="aspect-square overflow-hidden rounded-lg bg-[#0F172A]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`photo ${i+1}`} className="h-full w-full object-cover hover:scale-105 transition-transform" />
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">Клиент ещё не заполнил бриф.</p>
                )}

                {/* ── Prompt preview ── */}
                {promptText !== null && (
                  <div className="mt-4 rounded-xl border border-cyan-800/50 bg-[#0F172A] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Промпт для VSCode Claude
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">
                          {promptText.length} символов · {promptText.split('\n').length} строк
                        </span>
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(promptText).then(() => {
                              setPromptCopied(true);
                              setTimeout(() => setPromptCopied(false), 2500);
                            });
                          }}
                          className="rounded-lg bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600 transition-colors"
                        >
                          {promptCopied ? '✅ Скопировано' : '📋 Копировать'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={18}
                      spellCheck={false}
                      className="w-full rounded-lg border border-[#374151] bg-[#0B1120] p-3 font-mono text-[11px] leading-relaxed text-gray-200 outline-none focus:border-cyan-600 resize-y"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">
                      Можешь редактировать промпт перед копированием. Изменения не сохраняются — только для текущей копии.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* ── Изображения ── */}
            <div className="sm:col-span-2">
              <div className="rounded-xl border border-[#374151] bg-[#0B1120] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                    Изображения{photos.length > 0 ? ` (${photos.length})` : ''}
                  </p>
                  <label className={`cursor-pointer rounded-lg border border-[#374151] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#334155] transition-colors ${uploadingPhoto ? 'pointer-events-none opacity-50' : ''}`}>
                    {uploadingPhoto ? '⏳ Загрузка...' : '+ Добавить изображение'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadAdminPhoto(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {photos.length === 0 ? (
                  <p className="text-xs text-gray-600">Фотографии не загружены.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {photos.map((url, i) => (
                        <div key={i} className="space-y-1.5">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`block aspect-square overflow-hidden rounded-lg ${heroIdx === i ? 'ring-2 ring-orange-400' : 'bg-[#0F172A]'}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`photo ${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition-transform" />
                          </a>
                          <label className="flex cursor-pointer items-center justify-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200">
                            <input
                              type="radio"
                              name={`hero-${lead.id}`}
                              checked={heroIdx === i}
                              onChange={() => void saveHeroIndex(i)}
                              className="accent-orange-400"
                            />
                            Hero
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-gray-600">
                      Hero по умолчанию — первое фото (индекс 0). Текущий: #{heroIdx}.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── Site Automation ── */}
            <div className="sm:col-span-2">
              <div className="rounded-xl border border-[#374151] bg-[#0B1120] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Автоматизация сайта
                </p>

                {/* Status block — show when status is not "none" */}
                {siteStatus && siteStatus !== 'none' && (
                  <div className="mb-3 space-y-2">
                    {siteStatus === 'creating' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-900/50 px-3 py-1 text-xs font-medium text-yellow-400 border border-yellow-800/50">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Создаётся...
                      </span>
                    )}

                    {(siteStatus === 'created' || siteStatus === 'qa_passed' || siteStatus === 'qa_failed' || siteStatus === 'qa_pending') && (
                      <div className="space-y-3">
                        {/* Status badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          {siteStatus === 'created' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-900/50 px-3 py-1 text-xs font-medium text-green-400 border border-green-800/50">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              Создан
                            </span>
                          )}
                          {siteStatus === 'qa_passed' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-800/50">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              QA Пройден
                            </span>
                          )}
                          {siteStatus === 'qa_failed' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-900/50 px-3 py-1 text-xs font-medium text-orange-400 border border-orange-800/50">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                              QA Не пройден
                            </span>
                          )}
                          {siteStatus === 'qa_pending' && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-900/50 px-3 py-1 text-xs font-medium text-yellow-400 border border-yellow-800/50">
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                              QA Проверяется...
                            </span>
                          )}
                        </div>

                        {/* Links */}
                        <div className="flex flex-wrap gap-2">
                          {siteRepoUrl && (
                            <a href={siteRepoUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#334155] transition-colors">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                              </svg>
                              GitHub
                              <svg className="h-3 w-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
                            </a>
                          )}
                          {siteRepoName && (
                            <a
                              href={`https://${siteRepoName}.vercel.app`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#334155] transition-colors">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 22.525H0l12-21.05 12 21.05z"/>
                              </svg>
                              Открыть сайт
                              <svg className="h-3 w-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
                            </a>
                          )}
                        </div>

                        {/* Open site button — shown when site is created */}
                        {siteStatus === 'created' && siteRepoName && (
                          <a
                            href={`https://${siteRepoName}.vercel.app`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                            Проверить сайт
                          </a>
                        )}

                        {/* Re-run QA button — shown only after QA failed */}
                        {siteStatus === 'qa_failed' && (
                          <button
                            onClick={() => void runQa()}
                            disabled={qaRunning}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {qaRunning ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Проверка...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                                </svg>
                                Повторить QA
                              </>
                            )}
                          </button>
                        )}

                        {/* QA Report */}
                        {siteQaReport && (() => {
                          let report: QaReport | null = null;
                          try { report = JSON.parse(siteQaReport) as QaReport; } catch { return null; }
                          if (!report) return null;

                          const scoreColor =
                            report.score >= 70 ? 'text-emerald-400' :
                            report.score >= 50 ? 'text-yellow-400' :
                                                 'text-red-400';

                          const detailLabels: { key: keyof QaDetails; label: string }[] = [
                            { key: 'heroReadable',        label: 'Hero текст читаемый' },
                            { key: 'navigationVisible',   label: 'Навигация видна' },
                            { key: 'colorsConsistent',    label: 'Цвета согласованы' },
                            { key: 'layoutCorrect',       label: 'Layout не сломан' },
                            { key: 'fontsLoaded',         label: 'Шрифты загружены' },
                          ];

                          return (
                            <div className="mt-2 rounded-lg border border-[#374151] bg-[#0F172A] p-3 space-y-3">
                              {/* Score + passed */}
                              <div className="flex items-center gap-3">
                                <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
                                  {report.score}
                                  <span className="text-xs font-normal text-gray-500">/100</span>
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${report.passed ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/50' : 'bg-red-900/50 text-red-400 border border-red-800/50'}`}>
                                  {report.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </div>

                              {/* Details */}
                              <div className="grid grid-cols-2 gap-1">
                                {detailLabels.map(({ key, label }) => (
                                  <div key={key} className="flex items-center gap-1.5 text-[11px]">
                                    {report!.details[key] ? (
                                      <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                      </svg>
                                    ) : (
                                      <svg className="h-3.5 w-3.5 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                                      </svg>
                                    )}
                                    <span className="text-gray-400">{label}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Issues */}
                              {report.issues.length > 0 && (
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">Проблемы</p>
                                  <ul className="space-y-0.5">
                                    {report.issues.map((issue, i) => (
                                      <li key={i} className="text-[11px] text-red-300">• {issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {report.recommendations.length > 0 && (
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Рекомендации</p>
                                  <ul className="space-y-0.5">
                                    {report.recommendations.map((rec, i) => (
                                      <li key={i} className="text-[11px] text-gray-500">• {rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {siteStatus === 'error' && (
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/50 px-3 py-1 text-xs font-medium text-red-400 border border-red-800/50">
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          Ошибка
                        </span>
                        {(siteError ?? lead.siteError) && (
                          <p className="rounded-lg bg-red-950/30 border border-red-900/50 px-3 py-2 font-mono text-[10px] text-red-400 break-all">
                            {siteError ?? lead.siteError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Create Site button — show when none or error */}
                {(siteStatus === 'none' || siteStatus === null || siteStatus === 'error') && (
                  <button
                    onClick={() => void createSite()}
                    disabled={siteCreating}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {siteCreating ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Создание...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                        </svg>
                        {siteStatus === 'error' ? 'Повторить' : 'Создать сайт'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          {/* ── Action bar ── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* WhatsApp */}
              <a
                href={waLink(lead.contact)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
              >
                🔗 WhatsApp
              </a>

              {/* Delete */}
              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Удалить?</span>
                  <button
                    onClick={() => void softDelete()}
                    className="rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-[#374151] px-3 py-2 text-xs text-gray-400 hover:bg-[#334155]"
                  >
                    Нет
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-lg border border-red-800 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  🗑️ Удалить
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs font-medium text-green-400">✓ Сохранено</span>
              )}
              <button
                onClick={() => void save()}
                disabled={saving || Object.keys(draft).length === 0}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
              >
                {saving ? 'Saving…' : '💾 Сохранить'}
              </button>
            </div>
          </div>

          {/* ID row */}
          <p className="mt-3 font-mono text-[10px] text-gray-600">{lead.id}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [, setEditMap]        = useState<EditMap>({});

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/leads');
      const data = await res.json() as Lead[];
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  function handleUpdate(id: string, patch: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
    setEditMap((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }

  function handleDelete(id: string) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: 'deleted' } : l));
  }

  // Counts per status (excluding deleted from visible counts)
  const counts: Record<string, number> = { all: 0 };
  leads.forEach((l) => {
    if (l.status !== 'deleted') counts.all = (counts.all ?? 0) + 1;
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  });

  const visible = leads.filter((l) =>
    filter === 'all' ? l.status !== 'deleted' : l.status === filter,
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">VendShop CRM</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {loading ? 'Loading…' : `${visible.length} лидов`}
          </p>
        </div>
        <button
          onClick={() => void loadLeads()}
          className="rounded-lg border border-[#374151] bg-[#1E293B] px-3 py-2 text-sm text-gray-300 hover:bg-[#263349] transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ key, label }) => {
          const count = counts[key] ?? 0;
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'border border-[#374151] bg-[#1E293B] text-gray-400 hover:bg-[#263349]'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? 'bg-indigo-500 text-white' : 'bg-[#334155] text-gray-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-gray-500">No leads in this category.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
