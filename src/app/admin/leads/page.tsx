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
  selectedPalette:  string | null;
  selectedHero:     string | null;
  selectedMood:     string | null;
  briefSubmitted:   boolean;
  briefSubmittedAt: string | null;
  notes:           string | null;
  createdAt:       string;
  updatedAt:       string;
}

type EditMap = Record<string, Partial<Lead>>;

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

  // ── Services (from onboarding chat + additional from brief wishes) ─────────
  const servicesRaw = [lead.services ?? '', lead.wishes ?? '']
    .join('\n')
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const servicesList = servicesRaw.length
    ? servicesRaw.map((s) => `  - ${s}`).join('\n')
    : '  - (нет услуг — спроси клиента)';

  // ── Photos + logo ──────────────────────────────────────────────────────────
  const photos   = parsePhotos(lead.photoUrls);
  const photosBlock = photos.length
    ? photos.map((url, i) => `  ${i + 1}. ${url}`).join('\n')
    : '  (клиент не загрузил фото — используй Unsplash URLs по нише)';
  const logoBlock = lead.logoUrl
    ? `LOGO_URL: ${lead.logoUrl}`
    : 'LOGO: клиент не загрузил — используй текстовый логотип (businessName)';

  // ── Handle ecommerce separately ────────────────────────────────────────────
  if (isEcommerce) {
    return `# VendShop site: ${businessName} (E-COMMERCE)
# ⚠️ Использовать шаблон vendshop-ecommerce (НЕ vendshop-template)
# Клиент: ${lead.contact} | Язык: ${lead.language}
# Lead ID: ${lead.id}

## STEP 0 — Pre-flight
1. Клонировать vendshop-ecommerce через GitHub "Use this template"
2. Вызвать build_context_for_query: "vendshop ecommerce customization ${lead.businessType}"
3. Читай ТОЛЬКО: lib/config.ts, lib/constants.ts, lib/ui-translations.ts
   НЕ читай компоненты и страницы — архитектура уже правильная.

## STEP 1 — lib/config.ts
name:           '${businessName}'
tagline:        '${tagline}'
palette:        '${palette}'
language:       '${lead.language}'
whatsappNumber: '+${phone}'
contactEmail:   '${lead.email ?? ''}'
address:        '${lead.address ?? ''}'
workingHours:   '${lead.workingHours ?? ''}'
socialInstagram:'${lead.socialInstagram ?? ''}'
socialFacebook: '${lead.socialFacebook ?? ''}'
useLocalImages: false

## STEP 2 — lib/constants.ts
PRODUCTS (из онбординга + пожеланий):
${servicesList}

Для каждого товара нужно: name, description (1-2 предложения), price, image URL, category.
Цены извлеки из wishes ниже — если формат "Товар - 50€" или прайс-лист по URL.

## STEP 3 — Brand assets
${logoBlock}

PHOTOS (${photos.length}):
${photosBlock}

Prices PDF/image: ${lead.priceListUrl ?? 'нет — цены из wishes'}

## STEP 4 — Client wishes
${lead.wishes ?? '(клиент не оставил пожеланий)'}

Reference: ${lead.referenceUrl ?? 'нет'}

## STEP 5 — Deploy
npx tsc --noEmit && pnpm build
git remote add origin https://github.com/VadymMak/${name}.git
git push -u origin main
После Vercel deploy → добавь subdomain: ${name}.vendshop.shop`;
  }

  // ── Regular template (landing) ─────────────────────────────────────────────
  return `# VendShop site: ${businessName}
# Template: vendshop-template (templateType: ${templateType})
# Клиент: ${lead.contact} | Язык: ${lead.language}
# Lead ID: ${lead.id}

## STEP 0 — Pre-flight (ОБЯЗАТЕЛЬНО)
1. Клонировать vendshop-template через GitHub "Use this template" → название ${name}
2. Вызвать build_context_for_query: "vendshop template customization ${lead.businessType}"
3. Читай ТОЛЬКО эти файлы:
   - lib/config.ts (палитра, язык, tagline, контакты)
   - lib/constants.ts (услуги, фото, адрес)
   - lib/ui-translations.ts (проверь что нужный язык есть)
   НЕ читай компоненты/страницы — архитектура уже правильная, палитры протестированы.

## STEP 1 — lib/config.ts
export const SITE_CONFIG: SiteConfig = {
  name:           '${businessName}',
  tagline:        '${tagline}',
  templateType:   '${templateType}',
  palette:        '${palette}',              // пресет, не трогай цвета вручную
  language:       '${lead.language}',        // ВСЕ UI-тексты из ui-translations.ts
  headingFont:    '${headingFont}',
  whatsappNumber: '+${phone}',
  contactEmail:   '${lead.email ?? ''}',
  address:        '${lead.address ?? ''}',
  workingHours:   '${lead.workingHours ?? 'По договоренности'}',
  socialInstagram:'${lead.socialInstagram ?? ''}',
  socialFacebook: '${lead.socialFacebook ?? ''}',
  heroStyle:      '${lead.selectedHero ?? 'fullscreen'}',  // fullscreen | split | centered
  mood:           '${lead.selectedMood ?? 'modern'}',      // modern | cozy | strict
  useLocalImages: false,
};

## STEP 2 — lib/constants.ts
SERVICES (из онбординга + доп. из wishes):
${servicesList}

Для каждой услуги: name, description (1-2 предложения), price (если в wishes указана), duration (если релевантно).
Если цен нет — поставь "По запросу" / "Na vyžiadanie" / "On request" в зависимости от языка.

## STEP 3 — Brand assets
${logoBlock}

PHOTOS (${photos.length}):
${photosBlock}

Prices PDF/image: ${lead.priceListUrl ?? 'нет — цены из wishes'}

## STEP 4 — Client context
Пожелания: ${lead.wishes ?? '(нет)'}
Референс: ${lead.referenceUrl ?? '(нет)'}
Бизнес-тип: ${lead.businessType}
${lead.selectedMood ? `Настроение: ${lead.selectedMood} — это влияет на копирайтинг (modern = краткий и профессиональный, cozy = тёплый и дружелюбный, strict = формальный и строгий)` : ''}

## STEP 5 — Verify & deploy
- npx tsc --noEmit
- pnpm lint
- pnpm build (должен пройти без ошибок)
- git remote add origin https://github.com/VadymMak/${name}.git
- git push -u origin main
- Vercel → deploy → добавь subdomain: ${name}.vendshop.shop (CNAME уже настроен)

## ⚠️ Checklist перед пушем
- [ ] Все UI-тексты идут через t() из ui-translations.ts (не хардкод словацкого)
- [ ] Палитра применена через getPalette() — не поменяны цвета руками
- [ ] Все фото клиента использованы (или объяснено почему нет)
- [ ] Логотип клиента подставлен (если есть)
- [ ] Цены из wishes/прайс-листа попали в services
- [ ] Контакты (WhatsApp, Instagram, FB) кликабельные`;
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
            {lead.package && (
              <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-xs text-indigo-300 capitalize">
                {lead.package}
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
                <p className="rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2 text-sm text-gray-300">
                  {lead.businessType}
                </p>
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

              <Field label="Услуги">
                <p className="text-sm text-gray-300 leading-relaxed">{lead.services}</p>
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

                {lead.briefSubmitted ? (
                  <div className="space-y-3">
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

                    {/* Photos */}
                    {lead.photoUrls && (() => {
                      try {
                        const urls = JSON.parse(lead.photoUrls) as string[];
                        if (!urls.length) return null;
                        return (
                          <div>
                            <p className="mb-1.5 text-xs text-gray-500">Фото ({urls.length}):</p>
                            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                              {urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="aspect-square overflow-hidden rounded-lg bg-[#0F172A]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt={`photo ${i+1}`} className="h-full w-full object-cover hover:scale-105 transition-transform" />
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      } catch { return null; }
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
