import type { BusinessType, PricingPlan, FaqItem, HowItWorksStep, NavItem, Feature, ColorSchemeTokens, QuickBadgeDefinition, WeekSchedule, OrderAcceptanceSchedule, Testimonial, PackagePlan, PortfolioItem, CompetitorRow, ProcessStep, IncludedFeature, TemplateItem, CreateBusinessType, CreateHoursSchedule } from './types';

export const SITE_NAME = 'VendShop';
export const SITE_URL = 'https://vendshop.shop';
export const SITE_TAGLINE = 'Váš online obchod za 5 minút';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'vendshop.shop';

/** Full external URL for a shop subdomain: smak-shop → https://smak-shop.vendshop.shop */
export function getStoreUrl(slug: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `/shop/${slug}`;
  }
  return `https://${slug}.${ROOT_DOMAIN}`;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Funkcie', href: '#features' },
  { label: 'Ako to funguje', href: '#how-it-works' },
  { label: 'Cenník', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'physical',
    icon: '🛍️',
    title: 'Obchod s tovarom',
    description: 'Predávajte fyzické produkty online s jednoduchým katalógom a správou objednávok.',
    demo: '',
  },
  {
    id: 'food',
    icon: '🍕',
    title: 'Jedlo a produkty',
    description: 'Domáce jedlo, pekáreň, farmárske produkty — prijímajte objednávky online.',
    demo: 'https://krajina-trencin.vercel.app',
  },
  {
    id: 'restaurant',
    icon: '🍽️',
    title: 'Reštaurácia',
    description: 'Online menu, rezervácie a objednávky pre vašu reštauráciu alebo kaviareň.',
    demo: 'https://adriano-trencin.vercel.app',
  },
  {
    id: 'beauty',
    icon: '💅',
    title: 'Krása a wellness',
    description: 'Salón krásy, masáže, kozmetika — online rezervácie a predaj produktov.',
    demo: 'https://barbershop-trencin.vercel.app',
  },
  {
    id: 'repair',
    icon: '🔧',
    title: 'Opravovňa',
    description: 'Oprava telefónov, počítačov, áut — správa zákaziek a online objednávky.',
    demo: 'https://lj-servis.vercel.app',
  },
  {
    id: 'fashion',
    icon: '👟',
    title: 'Móda a obuv',
    description: 'Oblečenie, obuv, doplnky — online katalóg s veľkosťami, košíkom a objednávkami.',
    demo: 'https://krokshop-trencin.vercel.app',
  },
  {
    id: 'medical',
    icon: '🦷',
    title: 'Zdravotníctvo',
    description: 'Zubné kliniky, lekári, fyzioterapeuti — online objednávky a cenníky.',
    demo: 'https://dentcare-trencin.vercel.app',
  },
  {
    id: 'wellness',
    icon: '🧘',
    title: 'Fitness a wellness',
    description: 'Yoga štúdiá, fitness centrá, tanečné školy — rozvrh, trénerovia a online rezervácie.',
    demo: 'https://zenflow-ivory.vercel.app',
  },
  {
    id: 'nightlife',
    icon: '🪩',
    title: 'Bary a nočný život',
    description: 'Hookah bary, cocktail bary, kluby — menu, rezervácie a eventy v 3 jazykoch.',
    demo: 'https://ember-lounge.vercel.app',
  },
  {
    id: 'photography',
    icon: '📸',
    title: 'Fotografia',
    description: 'Fotografické štúdiá, videografi — portfólio, cenník a online rezervácie.',
    demo: 'https://lens-art-five.vercel.app',
  },
  {
    id: 'digital',
    icon: '💻',
    title: 'Digitálne produkty',
    description: 'Kurzy, e-booky, šablóny — predávajte digitálny obsah bez starostí.',
    demo: '',
  },
  {
    id: 'events',
    icon: '🎈',
    title: 'Eventy a dekorácie',
    description: 'Organizácia osláv, dekorácie, fotozone — ukážte portfólio a prijímajte objednávky.',
    demo: 'events',
  },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: 'register',
    step: 1,
    title: 'Zaregistrujte sa',
    description: 'Vytvorte si účet zadarmo za 30 sekúnd. Žiadna kreditná karta.',
    icon: '📝',
  },
  {
    id: 'customize',
    step: 2,
    title: 'Nastavte si obchod',
    description: 'Pridajte produkty, vyberte dizajn a nastavte platby.',
    icon: '🎨',
  },
  {
    id: 'sell',
    step: 3,
    title: 'Začnite predávať',
    description: 'Zdieľajte odkaz a prijímajte objednávky od zákazníkov.',
    icon: '🚀',
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: '€',
    period: 'mesiac',
    description: 'Pre začiatočníkov, ktorí chcú vyskúšať platformu.',
    features: [
      'Až 10 produktov',
      'Základné šablóny',
      'vendshop.shop subdoména',
      'E-mailová podpora',
    ],
    highlighted: false,
    cta: 'Začať zadarmo',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    currency: '€',
    period: 'mesiac',
    description: 'Pre rastúce biznisy, ktoré potrebujú viac.',
    features: [
      'Až 100 produktov',
      'Vlastná doména',
      'Všetky šablóny',
      'Prioritná podpora',
      'Analytika predajov',
      'Bez reklám VendShop',
    ],
    highlighted: true,
    cta: 'Vybrať Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    currency: '€',
    period: 'mesiac',
    description: 'Pre profesionálov, ktorí chcú maximum.',
    features: [
      'Neobmedzené produkty',
      'Vlastná doména',
      'Prémiové šablóny',
      'API prístup',
      'Pokročilá analytika',
      'Prioritná podpora 24/7',
      'Multi-jazyk obchod',
    ],
    highlighted: false,
    cta: 'Vybrať Pro',
  },
];

export const FEATURES: Feature[] = [
  {
    id: 'ai-descriptions',
    title: 'AI popisky produktov',
    description: 'Automaticky generované popisky produktov pomocou AI. Ušetrite hodiny písania.',
  },
  {
    id: 'multilang',
    title: 'Multi-jazyk (5 jazykov)',
    description: 'Obchod v slovenčine, češtine, ukrajinčine, nemčine aj angličtine — automaticky.',
  },
  {
    id: 'payments',
    title: 'Stripe & PayPal platby',
    description: 'Prijímajte platby kartou cez Stripe, PayPal alebo lokálne platobné brány.',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp integrácia',
    description: 'Zákazníci vás kontaktujú priamo cez WhatsApp. Objednávky aj chat na jednom mieste.',
  },
  {
    id: 'mobile',
    title: 'Mobilný dizajn',
    description: 'Váš obchod vyzerá skvele na každom zariadení — telefón, tablet aj počítač.',
  },
  {
    id: 'analytics',
    title: 'Analytika predajov',
    description: 'Sledujte predaje, návštevnosť a konverzie v reálnom čase.',
  },
  {
    id: 'security',
    title: 'SSL & GDPR',
    description: 'SSL certifikát, GDPR compliance a bezpečné platby zadarmo pre každý obchod.',
  },
  {
    id: 'custom-domain',
    title: 'Vlastná doména',
    description: 'Pripojte si vlastnú doménu alebo použite bezplatnú subdoménu vendshop.shop.',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Koľko stojí vytvorenie obchodu?',
    answer: 'Začať môžete úplne zadarmo. Platený plán začína od 12€ mesačne a obsahuje vlastnú doménu, viac produktov a pokročilé funkcie.',
  },
  {
    id: 'faq-2',
    question: 'Potrebujem technické znalosti?',
    answer: 'Nie. VendShop je navrhnutý pre ľudí bez technických znalostí. Obchod si vytvoríte za pár minút pomocou jednoduchého editora.',
  },
  {
    id: 'faq-3',
    question: 'Aké platobné metódy podporujete?',
    answer: 'Podporujeme Stripe, PayPal a bankové prevody. V SK/CZ tiež podporujeme platby kartou cez lokálne platobné brány.',
  },
  {
    id: 'faq-4',
    question: 'Môžem použiť vlastnú doménu?',
    answer: 'Áno! Na plánoch Starter a Pro si môžete pripojiť vlastnú doménu. Na Free pláne máte subdoménu vendshop.shop.',
  },
  {
    id: 'faq-5',
    question: 'Je možné predávať digitálne produkty?',
    answer: 'Áno, VendShop podporuje predaj digitálnych produktov — e-booky, kurzy, šablóny a ďalšie súbory na stiahnutie.',
  },
  {
    id: 'faq-6',
    question: 'Ako dlho trvá vytvorenie obchodu?',
    answer: 'Základný obchod si vytvoríte za 5 minút. Pridanie produktov a nastavenie dizajnu zvyčajne zaberie 1-2 hodiny.',
  },
];

// ===== Landing page testimonials =====

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'testimonial-1',
    name: 'Mária K.',
    businessType: 'food',
    rating: 5,
    textKey: 'testimonial1',
    avatarInitials: 'MK',
  },
  {
    id: 'testimonial-2',
    name: 'Tomáš B.',
    businessType: 'repair',
    rating: 5,
    textKey: 'testimonial2',
    avatarInitials: 'TB',
  },
  {
    id: 'testimonial-3',
    name: 'Olena S.',
    businessType: 'beauty',
    rating: 4,
    textKey: 'testimonial3',
    avatarInitials: 'OS',
  },
];

// ===== Shop color schemes =====

export const COLOR_SCHEMES: Record<string, ColorSchemeTokens> = {
  light: {
    bg: 'bg-white',
    bgCard: 'bg-gray-50',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    accent: 'bg-primary text-white',
    accentHover: 'hover:bg-primary-dark',
    border: 'border-gray-200',
    headerBg: 'bg-white',
    footerBg: 'bg-gray-50',
    footerText: 'text-gray-600',
    heroBg: 'bg-gradient-to-b from-gray-50 to-white',
    chipBg: 'bg-gray-100',
    chipText: 'text-gray-600',
    outlineBtn: 'border border-gray-300 text-gray-700 hover:bg-gray-100',
  },
  dark: {
    bg: 'bg-gray-950',
    bgCard: 'bg-gray-900',
    text: 'text-white',
    textMuted: 'text-gray-400',
    accent: 'bg-primary text-white',
    accentHover: 'hover:bg-primary-light',
    border: 'border-gray-800',
    headerBg: 'bg-gray-950',
    footerBg: 'bg-gray-900',
    footerText: 'text-gray-400',
    heroBg: 'bg-gradient-to-b from-gray-900 to-gray-950',
    chipBg: 'bg-gray-800',
    chipText: 'text-gray-300',
    outlineBtn: 'border border-gray-700 text-gray-300 hover:bg-gray-800',
  },
  warm: {
    bg: 'bg-warm-bg',
    bgCard: 'bg-warm-card',
    text: 'text-warm-text',
    textMuted: 'text-warm-muted',
    accent: 'bg-warm-accent text-white',
    accentHover: 'hover:bg-warm-accent-hover',
    border: 'border-warm-border',
    headerBg: 'bg-warm-card/92 backdrop-blur-xl',
    footerBg: 'bg-warm-dark',
    footerText: 'text-warm-footer',
    heroBg: 'bg-gradient-to-br from-warm-dark-deep via-warm-dark-mid to-warm-dark',
    chipBg: 'bg-warm-accent-light',
    chipText: 'text-warm-accent',
    outlineBtn: 'border border-warm-border text-warm-muted hover:border-warm-accent hover:text-warm-accent',
    headingFont: 'font-heading',
  },
  bold: {
    bg: 'bg-indigo-950',
    bgCard: 'bg-indigo-900',
    text: 'text-white',
    textMuted: 'text-indigo-300',
    accent: 'bg-pink-500 text-white',
    accentHover: 'hover:bg-pink-600',
    border: 'border-indigo-800',
    headerBg: 'bg-indigo-950',
    footerBg: 'bg-indigo-900',
    footerText: 'text-indigo-300',
    heroBg: 'bg-gradient-to-b from-indigo-900 to-indigo-950',
    chipBg: 'bg-indigo-800',
    chipText: 'text-indigo-200',
    outlineBtn: 'border border-indigo-700 text-indigo-200 hover:bg-indigo-800',
  },
  festive: {
    bg: 'bg-white',
    bgCard: 'bg-red-50',
    text: 'text-red-950',
    textMuted: 'text-red-700',
    accent: 'bg-red-700 text-white',
    accentHover: 'hover:bg-red-800',
    border: 'border-red-200',
    headerBg: 'bg-red-900',
    footerBg: 'bg-red-900',
    footerText: 'text-red-200',
    heroBg: 'bg-gradient-to-b from-red-50 to-white',
    chipBg: 'bg-red-100',
    chipText: 'text-red-800',
    outlineBtn: 'border border-red-300 text-red-800 hover:bg-red-50',
  },
  elegant: {
    bg: 'bg-stone-50',
    bgCard: 'bg-white',
    text: 'text-stone-900',
    textMuted: 'text-stone-500',
    accent: 'bg-rose-500 text-white',
    accentHover: 'hover:bg-rose-600',
    border: 'border-stone-200',
    headerBg: 'bg-white',
    footerBg: 'bg-stone-100',
    footerText: 'text-stone-600',
    heroBg: 'bg-gradient-to-b from-rose-50 to-stone-50',
    chipBg: 'bg-rose-50',
    chipText: 'text-rose-700',
    outlineBtn: 'border border-stone-300 text-stone-700 hover:bg-stone-100',
  },
};

// ===== Default structured hours =====

const DAY_CLOSED = { open: false, from: '09:00', to: '18:00' } as const;
const DAY_OPEN   = { open: true,  from: '09:00', to: '18:00' } as const;

export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = [
  { ...DAY_OPEN },  // Mon
  { ...DAY_OPEN },  // Tue
  { ...DAY_OPEN },  // Wed
  { ...DAY_OPEN },  // Thu
  { ...DAY_OPEN },  // Fri
  { ...DAY_CLOSED }, // Sat
  { ...DAY_CLOSED }, // Sun
];

export const DEFAULT_ORDER_ACCEPTANCE: OrderAcceptanceSchedule = {
  enabled: false,
  from: '09:00',
  to: '21:00',
};

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// ===== Quick info badges =====
// icon = inline SVG path data (rendered inside a 24×24 viewBox)

export const QUICK_BADGES: QuickBadgeDefinition[] = [
  { id: 'fast_delivery',    icon: 'truck',        labelKey: 'badgeFastDelivery' },
  { id: 'same_day',         icon: 'clock',        labelKey: 'badgeSameDay' },
  { id: 'free_shipping',    icon: 'gift',         labelKey: 'badgeFreeShipping' },
  { id: 'pay_online',       icon: 'credit_card',  labelKey: 'badgePayOnline' },
  { id: 'pay_cash',         icon: 'banknote',     labelKey: 'badgePayCash' },
  { id: 'paypal',           icon: 'paypal',       labelKey: 'badgePaypal' },
  { id: 'pickup',           icon: 'store',        labelKey: 'badgePickup' },
  { id: 'warranty',         icon: 'shield',       labelKey: 'badgeWarranty' },
  { id: 'eco_friendly',     icon: 'leaf',         labelKey: 'badgeEcoFriendly' },
  { id: 'handmade',         icon: 'hand',         labelKey: 'badgeHandmade' },
  { id: 'support_24_7',     icon: 'headset',      labelKey: 'badgeSupport247' },
  { id: 'returns',          icon: 'refresh',      labelKey: 'badgeReturns' },
  { id: 'local_product',    icon: 'map_pin',      labelKey: 'badgeLocalProduct' },
  { id: 'organic',          icon: 'sprout',       labelKey: 'badgeOrganic' },
  { id: 'reservation',      icon: 'calendar',     labelKey: 'badgeReservation' },
  { id: 'discount',         icon: 'percent',      labelKey: 'badgeDiscount' },
];

// ===== New landing page data (done-for-you service concept) =====

export const PROCESS_STEPS: ProcessStep[] = [
  { id: 'contact', step: 1, icon: '💬', titleKey: 'process.step1.title', descKey: 'process.step1.desc' },
  { id: 'preview', step: 2, icon: '🖥️', titleKey: 'process.step2.title', descKey: 'process.step2.desc' },
  { id: 'pay', step: 3, icon: '✅', titleKey: 'process.step3.title', descKey: 'process.step3.desc' },
];

export const PACKAGES: PackagePlan[] = [
  {
    id: 'landing',
    name: 'Landing',
    price: 249,
    monthlyPrice: 29,
    currency: '€',
    description: 'packages.landing.desc',
    features: [
      'packages.landing.f1',
      'packages.landing.f2',
      'packages.landing.f3',
      'packages.landing.f4',
      'packages.landing.f5',
      'packages.landing.f6',
      'packages.landing.f7',
    ],
    revisionRounds: 2,
    monthlyChanges: 1,
    highlighted: false,
    cta: 'packages.landing.cta',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 399,
    monthlyPrice: 39,
    currency: '€',
    description: 'packages.premium.desc',
    features: [
      'packages.premium.f1',
      'packages.premium.f2',
      'packages.premium.f3',
      'packages.premium.f4',
      'packages.premium.f5',
      'packages.premium.f6',
      'packages.premium.f7',
    ],
    revisionRounds: 5,
    monthlyChanges: 3,
    highlighted: true,
    badge: 'packages.premium.badge',
    cta: 'packages.premium.cta',
  },
  {
    id: 'individual',
    name: 'Individual',
    price: 799,
    monthlyPrice: 49,
    currency: '€',
    description: 'packages.individual.desc',
    features: [
      'packages.individual.f1',
      'packages.individual.f2',
      'packages.individual.f3',
      'packages.individual.f4',
      'packages.individual.f5',
      'packages.individual.f6',
      'packages.individual.f7',
    ],
    revisionRounds: -1,
    monthlyChanges: 5,
    highlighted: false,
    cta: 'packages.individual.cta',
  },
];

export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  { id: 'krajina', name: 'Krajina', url: 'https://krajina-trencin.vercel.app', tags: ['food', 'delivery'], descKey: 'portfolio.krajina', screenshotPlaceholder: '🍕' },
  { id: 'adriano', name: 'Adriano', url: 'https://adriano-trencin.vercel.app', tags: ['restaurant', 'menu'], descKey: 'portfolio.adriano', screenshotPlaceholder: '🍽️' },
  { id: 'barbershop', name: 'Barbershop', url: 'https://barbershop-trencin.vercel.app', tags: ['beauty', 'booking'], descKey: 'portfolio.barbershop', screenshotPlaceholder: '💈' },
  { id: 'lj-servis', name: 'LJ Servis', url: 'https://lj-servis.vercel.app', tags: ['repair', 'service'], descKey: 'portfolio.ljservis', screenshotPlaceholder: '🔧' },
  { id: 'krokshop', name: 'KrokShop', url: 'https://krokshop-trencin.vercel.app', tags: ['e-commerce', 'fashion'], descKey: 'portfolio.krokshop', screenshotPlaceholder: '👟' },
  { id: 'dentcare', name: 'DentCare', url: 'https://dentcare-trencin.vercel.app', tags: ['medical', 'clinic'], descKey: 'portfolio.dentcare', screenshotPlaceholder: '🦷' },
  { id: 'zenflow', name: 'ZenFlow', url: 'https://zenflow-ivory.vercel.app', tags: ['wellness', 'yoga'], descKey: 'portfolio.zenflow', screenshotPlaceholder: '🧘' },
  { id: 'ember', name: 'Ember Lounge', url: 'https://ember-lounge.vercel.app', tags: ['bar', 'nightlife'], descKey: 'portfolio.ember', screenshotPlaceholder: '🪩' },
  { id: 'transport', name: 'Transport', url: 'https://transportation-trencin.vercel.app', tags: ['transport', 'logistics'], descKey: 'portfolio.transport', screenshotPlaceholder: '🚛' },
  { id: 'lensart', name: 'LensArt', url: 'https://lens-art-five.vercel.app', tags: ['photography', 'portfolio'], descKey: 'portfolio.lensart', screenshotPlaceholder: '📸' },
  { id: 'autofix', name: 'AutoFix', url: 'https://auto-fix-roan.vercel.app', tags: ['auto', 'service'], descKey: 'portfolio.autofix', screenshotPlaceholder: '🔧' },
];

export const INCLUDED_FEATURES: IncludedFeature[] = [
  { id: 'responsive', icon: '📱', titleKey: 'included.responsive.title', descKey: 'included.responsive.desc' },
  { id: 'seo', icon: '🔍', titleKey: 'included.seo.title', descKey: 'included.seo.desc' },
  { id: 'ai', icon: '🤖', titleKey: 'included.ai.title', descKey: 'included.ai.desc' },
  { id: 'whatsapp', icon: '💬', titleKey: 'included.whatsapp.title', descKey: 'included.whatsapp.desc' },
  { id: 'multilang', icon: '🌍', titleKey: 'included.multilang.title', descKey: 'included.multilang.desc' },
  { id: 'hosting', icon: '☁️', titleKey: 'included.hosting.title', descKey: 'included.hosting.desc' },
];

export const COMPETITOR_TABLE: CompetitorRow[] = [
  { feature: 'competitor.timeToLaunch',      vendshop: 'competitor.vs.v1', durable: 'competitor.vs.d1', wixSquarespace: 'competitor.vs.w1', freelancer: 'competitor.vs.f1' },
  { feature: 'competitor.multilingual',      vendshop: 'competitor.vs.v2', durable: 'competitor.vs.d2', wixSquarespace: 'competitor.vs.w2', freelancer: 'competitor.vs.f2' },
  { feature: 'competitor.bizTemplates',      vendshop: 'competitor.vs.v3', durable: 'competitor.vs.d3', wixSquarespace: 'competitor.vs.w3', freelancer: 'competitor.vs.f3' },
  { feature: 'competitor.livePreview',       vendshop: '✓',               durable: '✗',               wixSquarespace: '✗',               freelancer: '✗' },
  { feature: 'competitor.monthlyPrice',      vendshop: 'competitor.vs.v5', durable: 'competitor.vs.d5', wixSquarespace: 'competitor.vs.w5', freelancer: 'competitor.vs.f5' },
  { feature: 'competitor.euSupport',         vendshop: 'competitor.vs.v6', durable: 'competitor.vs.d6', wixSquarespace: 'competitor.vs.w6', freelancer: 'competitor.vs.f6' },
];

export const STATS = [
  { value: '9+', labelKey: 'stats.projects' },
  { value: '48h', labelKey: 'stats.delivery' },
  { value: '4.9★', labelKey: 'stats.rating' },
  { value: '€249', labelKey: 'stats.from' },
];

export const TEMPLATE_ITEMS: TemplateItem[] = [
  {
    id: 'classic',
    nameKey: 'templates.classic.name',
    descKey: 'templates.classic.desc',
    palette: '#3b82f6',
    businessTypes: ['repair', 'home_services', 'physical', 'ecommerce'],
    previewUrl: 'https://lj-servis.vercel.app',
    emoji: '🔧',
  },
  {
    id: 'warm',
    nameKey: 'templates.warm.name',
    descKey: 'templates.warm.desc',
    palette: '#d4641a',
    businessTypes: ['food', 'restaurant'],
    previewUrl: 'https://adriano-trencin.vercel.app',
    emoji: '🍕',
  },
  {
    id: 'natural',
    nameKey: 'templates.natural.name',
    descKey: 'templates.natural.desc',
    palette: '#3d5a2b',
    businessTypes: ['beauty', 'health'],
    previewUrl: 'https://barbershop-trencin.vercel.app',
    emoji: '🌿',
  },
  {
    id: 'bold',
    nameKey: 'templates.bold.name',
    descKey: 'templates.bold.desc',
    palette: '#e11d48',
    businessTypes: ['digital', 'education'],
    previewUrl: 'https://krokshop-trencin.vercel.app',
    emoji: '⚡',
  },
  {
    id: 'dark',
    nameKey: 'templates.dark.name',
    descKey: 'templates.dark.desc',
    palette: '#cbd5e1',
    businessTypes: ['photography', 'design'],
    previewUrl: 'https://lens-art-five.vercel.app',
    emoji: '📸',
  },
  {
    id: 'medical',
    nameKey: 'templates.medical.name',
    descKey: 'templates.medical.desc',
    palette: '#0f766e',
    businessTypes: ['medical'],
    previewUrl: 'https://dentcare-trencin.vercel.app',
    emoji: '🦷',
  },
];

// ===== Shop item category labels =====

export const ITEM_TYPE_LABELS: Record<string, string> = {
  PRODUCT: 'Produkty',
  SERVICE: 'Služby',
  MENU_ITEM: 'Menu',
  PORTFOLIO: 'Portfólio',
};

// ===== Default shop currency format =====

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  CZK: 'Kč',
  UAH: '₴',
  USD: '$',
};

// ===== /create page — business types catalog =====

export const CREATE_BUSINESS_TYPES: CreateBusinessType[] = [
  {
    id: 'barbershop', icon: 'scissors', style: 'classic',
    template: {
      heroKicker: 'EST. 2019 · WALK-INS WELCOME',
      heroTitle: 'Sharp cuts.\nSharper confidence.',
      heroSub: 'Old-school craft, modern precision. Booking slots open this week.',
      ctaPrimary: 'Book a chair', ctaSecondary: 'See services',
      sectionsTitle: 'Services',
      sections: [
        { title: 'Signature Cut', meta: '45 min · from €28', body: 'Consult, wash, scissor or clipper work, hot-towel finish.' },
        { title: 'Beard Sculpt', meta: '30 min · from €18', body: 'Line-up, trim and conditioning oil — shaped to your face.' },
        { title: 'Father & Son', meta: '60 min · €42', body: 'Two chairs, one appointment. Saturdays fill up fast.' },
      ],
      galleryLabel: 'The shop',
    },
    palettes: [
      { id: 'classic', name: 'Mahogany', primary: '#a3551f', bg: '#f7f2ea', fg: '#1a140e', muted: '#6b5b4a', card: '#ffffff' },
      { id: 'charcoal', name: 'Charcoal', primary: '#d4af37', bg: '#14110f', fg: '#f5efe6', muted: '#9a8d7b', card: '#1f1a17' },
      { id: 'navy', name: 'Navy & Brass', primary: '#c9a44c', bg: '#0f1a2a', fg: '#eef2f7', muted: '#8fa0b8', card: '#17263a' },
      { id: 'cream', name: 'Cream', primary: '#1a1a1a', bg: '#fbf7f0', fg: '#1a1a1a', muted: '#6b6358', card: '#ffffff' },
    ],
  },
  {
    id: 'restaurant', icon: 'fork', style: 'warm',
    template: {
      heroKicker: 'FARM-FORWARD · OPEN TUE–SUN',
      heroTitle: 'Seasonal plates,\nlocal hands.',
      heroSub: 'A short, handwritten menu that changes with what the market offers each week.',
      ctaPrimary: 'Reserve a table', ctaSecondary: 'View menu',
      sectionsTitle: 'This week',
      sections: [
        { title: 'Heirloom tomato, stracciatella', meta: '€14', body: 'Basil oil, sourdough crumb, aged balsamic.' },
        { title: 'Slow-braised short rib', meta: '€28', body: 'Red wine jus, parsnip purée, roasted shallot.' },
        { title: 'Lemon olive oil cake', meta: '€9', body: 'Whipped mascarpone, candied zest.' },
      ],
      galleryLabel: 'The room',
    },
    palettes: [
      { id: 'terracotta', name: 'Terracotta', primary: '#c2553a', bg: '#fbf5ec', fg: '#2a1d15', muted: '#7b6554', card: '#ffffff' },
      { id: 'olive', name: 'Olive & Ink', primary: '#5c6b3a', bg: '#f5f2ea', fg: '#1c1c17', muted: '#6b6f5a', card: '#ffffff' },
      { id: 'merlot', name: 'Merlot', primary: '#9b2c3c', bg: '#1a1012', fg: '#f3ebe3', muted: '#a4918a', card: '#23181a' },
    ],
  },
  {
    id: 'beauty', icon: 'sparkles', style: 'natural',
    template: {
      heroKicker: 'A QUIET LITTLE STUDIO',
      heroTitle: 'Beauty, handled\nwith care.',
      heroSub: 'Unhurried appointments by a small team. Book online, we\'ll take it from there.',
      ctaPrimary: 'Book now', ctaSecondary: 'Our team',
      sectionsTitle: 'Treatments',
      sections: [
        { title: 'Colour & gloss', meta: '120 min · from €95', body: 'Balayage, highlights or all-over — finished with a shine treatment.' },
        { title: 'Gel manicure', meta: '60 min · €38', body: 'Shape, cuticle care and a long-lasting cured finish.' },
        { title: 'Hydrafacial', meta: '45 min · €75', body: 'Cleanse, extract, hydrate. You\'ll glow for days.' },
      ],
      galleryLabel: 'The space',
    },
    palettes: [
      { id: 'blush', name: 'Blush', primary: '#c8708b', bg: '#faf2f1', fg: '#2a1d23', muted: '#8a6f7a', card: '#ffffff' },
      { id: 'mauve', name: 'Mauve', primary: '#8a5b8e', bg: '#f4eef2', fg: '#221a24', muted: '#796477', card: '#ffffff' },
      { id: 'sand', name: 'Sand', primary: '#a58059', bg: '#f7f1e8', fg: '#231c15', muted: '#7c6a56', card: '#ffffff' },
      { id: 'nightrose', name: 'Night Rose', primary: '#e8a2b0', bg: '#1a1318', fg: '#f4e9ec', muted: '#ac8e95', card: '#231a20' },
    ],
  },
  {
    id: 'auto', icon: 'car', style: 'classic',
    template: {
      heroKicker: 'MON–SAT · CERTIFIED TECHNICIANS',
      heroTitle: 'Honest work.\nBooked online.',
      heroSub: 'Upfront quotes. Real-time updates. We show you the old parts.',
      ctaPrimary: 'Book service', ctaSecondary: 'Get a quote',
      sectionsTitle: 'Services',
      sections: [
        { title: 'Full diagnostic', meta: '60 min · €49', body: 'OBD scan, visual inspection, written report.' },
        { title: 'Brakes & pads', meta: '2h · from €180', body: 'OEM-grade parts, 12-month warranty.' },
        { title: 'Oil & filter', meta: '30 min · from €69', body: 'Manufacturer-specified oil, no upsells.' },
      ],
      galleryLabel: 'The garage',
    },
    palettes: [
      { id: 'steel', name: 'Steel & Amber', primary: '#f59e0b', bg: '#0f141c', fg: '#e8edf5', muted: '#8a95a8', card: '#181f2b' },
      { id: 'red', name: 'Racing Red', primary: '#dc2626', bg: '#0a0a0a', fg: '#f5f5f5', muted: '#9a9a9a', card: '#171717' },
      { id: 'clean', name: 'Clean White', primary: '#1f6feb', bg: '#f7f9fc', fg: '#0b1220', muted: '#5a6475', card: '#ffffff' },
    ],
  },
  {
    id: 'dentist', icon: 'tooth', style: 'medical',
    template: {
      heroKicker: 'GENTLE · MODERN · ALL AGES',
      heroTitle: 'A calmer kind\nof dental visit.',
      heroSub: 'Transparent pricing, sedation options, and Saturday hours for busy families.',
      ctaPrimary: 'Book a visit', ctaSecondary: 'Meet the team',
      sectionsTitle: 'Care',
      sections: [
        { title: 'New-patient exam', meta: '45 min · €59', body: 'X-rays, cleaning and a written plan — no pressure to book more.' },
        { title: 'Clear aligners', meta: 'Free consult', body: 'Digital scan, custom plan, in-house monitoring.' },
        { title: 'Emergency visit', meta: 'Same-day · €89', body: 'Pain? Call us before 2pm and you\'ll be seen today.' },
      ],
      galleryLabel: 'The clinic',
    },
    palettes: [
      { id: 'sky', name: 'Sky', primary: '#0ea5e9', bg: '#f4f9fc', fg: '#0b1e2a', muted: '#5a7488', card: '#ffffff' },
      { id: 'mint', name: 'Mint', primary: '#10b981', bg: '#f2faf6', fg: '#0f1f18', muted: '#5a7a6c', card: '#ffffff' },
      { id: 'indigo', name: 'Indigo', primary: '#4f46e5', bg: '#f5f6fb', fg: '#0f1129', muted: '#656a87', card: '#ffffff' },
    ],
  },
  {
    id: 'water', icon: 'droplet', style: 'classic',
    template: {
      heroKicker: 'FREE DELIVERY · 5 & 19 L',
      heroTitle: 'Cold, clean water —\non your schedule.',
      heroSub: 'Set it once, we show up weekly. Pause or skip anytime from the app.',
      ctaPrimary: 'Start subscription', ctaSecondary: 'One-time order',
      sectionsTitle: 'Plans',
      sections: [
        { title: 'Starter — 2× 19L', meta: '€14 / week', body: 'Enough for a small household. Free first dispenser loan.' },
        { title: 'Family — 4× 19L', meta: '€26 / week', body: 'Our most popular. Flexible delivery days.' },
        { title: 'Office — 10× 19L', meta: 'Custom quote', body: 'Invoicing, VAT receipts, after-hours drop-off.' },
      ],
      galleryLabel: 'From source',
    },
    palettes: [
      { id: 'aqua', name: 'Aqua', primary: '#06b6d4', bg: '#f1fafd', fg: '#07283a', muted: '#4e7a8c', card: '#ffffff' },
      { id: 'deep', name: 'Deep Blue', primary: '#1d4ed8', bg: '#f5f7fc', fg: '#0a1533', muted: '#5c6684', card: '#ffffff' },
      { id: 'glacier', name: 'Glacier', primary: '#0ea5e9', bg: '#0b1a26', fg: '#e6f3fa', muted: '#7ea0b5', card: '#142532' },
    ],
  },
  {
    id: 'electronics', icon: 'wrench', style: 'bold',
    template: {
      heroKicker: 'WHILE-YOU-WAIT · 90-DAY WARRANTY',
      heroTitle: 'Fixed today.\nNot next week.',
      heroSub: 'Transparent flat-rate pricing for phones, tablets and laptops. Quote in 60 seconds.',
      ctaPrimary: 'Get instant quote', ctaSecondary: 'Drop-off info',
      sectionsTitle: 'Common fixes',
      sections: [
        { title: 'Screen replacement', meta: '30–60 min · from €79', body: 'OEM-grade panels, tested before you leave.' },
        { title: 'Battery swap', meta: '45 min · from €49', body: 'Original or high-capacity cell, calibrated on the spot.' },
        { title: 'Water damage rescue', meta: '24–48 h · from €95', body: 'Ultrasonic board cleaning, diagnostic, no-fix no-fee.' },
      ],
      galleryLabel: 'Workshop',
    },
    palettes: [
      { id: 'electric', name: 'Electric', primary: '#22d3ee', bg: '#0a1020', fg: '#e6f1ff', muted: '#8596b5', card: '#131a2e' },
      { id: 'lime', name: 'Lime', primary: '#84cc16', bg: '#0e1410', fg: '#edf5e4', muted: '#8ea58a', card: '#18211b' },
      { id: 'violet', name: 'Violet', primary: '#8b5cf6', bg: '#f5f4fc', fg: '#120f2b', muted: '#605a84', card: '#ffffff' },
    ],
  },
  {
    id: 'yoga', icon: 'lotus', style: 'natural',
    template: {
      heroKicker: 'ALL LEVELS · FIRST CLASS FREE',
      heroTitle: 'Breathe in.\nBreathe out.',
      heroSub: 'Small classes led by teachers who actually know your name. Drop in or commit — both work.',
      ctaPrimary: 'Book a class', ctaSecondary: 'See the schedule',
      sectionsTitle: 'Classes',
      sections: [
        { title: 'Slow Flow', meta: '60 min · all levels', body: 'Gentle vinyasa, long holds, guided breathwork.' },
        { title: 'Power Hour', meta: '60 min · intermediate', body: 'Stronger sequences to build heat and focus.' },
        { title: 'Restorative', meta: '75 min · all levels', body: 'Props, bolsters, quiet. Exactly what the week needs.' },
      ],
      galleryLabel: 'The studio',
    },
    palettes: [
      { id: 'sage', name: 'Sage', primary: '#6b8e5a', bg: '#f5f2ea', fg: '#1b2418', muted: '#6e7564', card: '#ffffff' },
      { id: 'clay', name: 'Clay', primary: '#b4613b', bg: '#faf3ec', fg: '#231811', muted: '#7c6656', card: '#ffffff' },
      { id: 'dusk', name: 'Dusk', primary: '#e2a76f', bg: '#1a1712', fg: '#efe7db', muted: '#a59583', card: '#231e17' },
    ],
  },
  {
    id: 'photography', icon: 'camera', style: 'dark',
    template: {
      heroKicker: 'AVAILABLE WORLDWIDE · 2026',
      heroTitle: 'Photographs\nthat slow down.',
      heroSub: 'Weddings, editorial, and the in-between. I shoot mostly film, occasionally digital.',
      ctaPrimary: 'Check a date', ctaSecondary: 'View portfolio',
      sectionsTitle: 'Work',
      sections: [
        { title: 'Editorial', meta: 'Commissions', body: 'Stories, essays, and brand features — usually quiet, always honest.' },
        { title: 'Weddings', meta: 'Booking 2026', body: 'Full-day documentary coverage. Limited slots per year.' },
        { title: 'Prints', meta: 'Shop', body: 'Signed editions, open & limited runs.' },
      ],
      galleryLabel: 'Selected work',
    },
    palettes: [
      { id: 'paper', name: 'Paper', primary: '#111111', bg: '#f5f2ed', fg: '#111111', muted: '#6a645c', card: '#ffffff' },
      { id: 'noir', name: 'Noir', primary: '#d4d4d4', bg: '#0a0a0a', fg: '#f5f5f5', muted: '#8a8a8a', card: '#141414' },
      { id: 'sepia', name: 'Sepia', primary: '#8b5a2b', bg: '#f4ede2', fg: '#1d140c', muted: '#6e5a45', card: '#ffffff' },
    ],
  },
  {
    id: 'agency', icon: 'layers', style: 'bold',
    template: {
      heroKicker: 'INDEPENDENT STUDIO · LISBON / REMOTE',
      heroTitle: 'We ship websites\nthat convert.',
      heroSub: 'Brand, product, and growth — in that order. Small senior team, no handoffs.',
      ctaPrimary: 'Start a project', ctaSecondary: 'See work',
      sectionsTitle: 'Services',
      sections: [
        { title: 'Brand Sprint', meta: '2 weeks · fixed fee', body: 'Strategy, identity and a launch-ready site.' },
        { title: 'Product Design', meta: 'Monthly retainer', body: 'Embedded with your team. Figma to production.' },
        { title: 'Growth', meta: 'Ongoing', body: 'Landing pages, tests, and the data to back them up.' },
      ],
      galleryLabel: 'Selected clients',
    },
    palettes: [
      { id: 'graphite', name: 'Graphite', primary: '#22c55e', bg: '#0b0f1a', fg: '#e8edf5', muted: '#8a95a8', card: '#141b2b' },
      { id: 'paperw', name: 'Paper', primary: '#0b0f1a', bg: '#f7f7f5', fg: '#0b0f1a', muted: '#5a6475', card: '#ffffff' },
      { id: 'electric2', name: 'Electric Blue', primary: '#2563eb', bg: '#0a0f1f', fg: '#e8edf5', muted: '#8795b0', card: '#131a2c' },
    ],
  },
  {
    id: 'education', icon: 'book', style: 'bold',
    template: {
      heroKicker: 'COHORTS OPEN FOR FALL 2026',
      heroTitle: 'Learn the craft.\nKeep the teacher.',
      heroSub: 'Small, live cohorts led by working professionals. Lifetime access to the community.',
      ctaPrimary: 'Apply now', ctaSecondary: 'Download syllabus',
      sectionsTitle: 'Programs',
      sections: [
        { title: 'UX Foundations', meta: '8 weeks · €890', body: 'Research, IA, interaction. Portfolio-ready project at the end.' },
        { title: 'Frontend Intensive', meta: '10 weeks · €1,290', body: 'React, TypeScript, and shipping real features.' },
        { title: 'Brand & Identity', meta: '6 weeks · €690', body: 'Type, color, systems — taught by working designers.' },
      ],
      galleryLabel: 'Campus',
    },
    palettes: [
      { id: 'forest', name: 'Forest', primary: '#166534', bg: '#f3f6f2', fg: '#0f1d13', muted: '#5a6c5a', card: '#ffffff' },
      { id: 'ink', name: 'Ink', primary: '#1e40af', bg: '#f6f7fb', fg: '#0a1129', muted: '#5a6380', card: '#ffffff' },
      { id: 'cream2', name: 'Cream', primary: '#9a3412', bg: '#faf3e8', fg: '#1e1510', muted: '#7b6552', card: '#ffffff' },
    ],
  },
  {
    id: 'design', icon: 'palette', style: 'dark',
    template: {
      heroKicker: 'INDEPENDENT · 2019 — PRESENT',
      heroTitle: 'Studio for\nbrands & objects.',
      heroSub: 'Visual identity, packaging, and occasionally a website. One project at a time.',
      ctaPrimary: 'Work with us', ctaSecondary: 'View archive',
      sectionsTitle: 'Practice',
      sections: [
        { title: 'Identity', meta: 'From discovery to rollout', body: 'Naming, marks, typography, and the system to hold it all together.' },
        { title: 'Packaging', meta: 'Print & production', body: 'We work with our printers — and yours — to get it right.' },
        { title: 'Digital', meta: 'Microsites & portfolios', body: 'Quiet, opinionated, and built to last.' },
      ],
      galleryLabel: 'Archive',
    },
    palettes: [
      { id: 'bone', name: 'Bone', primary: '#c2410c', bg: '#f1ede3', fg: '#1a1612', muted: '#6e6454', card: '#ffffff' },
      { id: 'midnight', name: 'Midnight', primary: '#fbbf24', bg: '#0e0f12', fg: '#f4f1ea', muted: '#938a7a', card: '#1a1b20' },
      { id: 'raspberry', name: 'Raspberry', primary: '#be185d', bg: '#fbf6f7', fg: '#1d0f15', muted: '#7a5966', card: '#ffffff' },
    ],
  },
];

export const CREATE_PLANS = [
  { id: 'free' as const, price: 0 },
  { id: 'starter' as const, price: 19 },
  { id: 'pro' as const, price: 39, popular: true },
];

export const CREATE_DEFAULT_SCHEDULE: CreateHoursSchedule = {
  mon: { open: true, from: '09:00', to: '18:00' },
  tue: { open: true, from: '09:00', to: '18:00' },
  wed: { open: true, from: '09:00', to: '18:00' },
  thu: { open: true, from: '09:00', to: '18:00' },
  fri: { open: true, from: '09:00', to: '18:00' },
  sat: { open: false, from: '09:00', to: '13:00' },
  sun: { open: false, from: '09:00', to: '13:00' },
};

export const CREATE_STORE_KEY = 'vendshop_create_state_v1';

export const COOKIE_ACCEPTED_KEY = 'vendshop_cookie_accepted';
