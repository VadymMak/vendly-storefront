import type { BusinessType, PricingPlan, FaqItem, HowItWorksStep, NavItem, Feature, ColorSchemeTokens, QuickBadgeDefinition, WeekSchedule, OrderAcceptanceSchedule, Testimonial } from './types';

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
    demo: 'food',
  },
  {
    id: 'restaurant',
    icon: '🍽️',
    title: 'Reštaurácia',
    description: 'Online menu, rezervácie a objednávky pre vašu reštauráciu alebo kaviareň.',
    demo: '',
  },
  {
    id: 'beauty',
    icon: '💅',
    title: 'Krása a wellness',
    description: 'Salón krásy, masáže, kozmetika — online rezervácie a predaj produktov.',
    demo: '',
  },
  {
    id: 'repair',
    icon: '🔧',
    title: 'Opravovňa',
    description: 'Oprava telefónov, počítačov, áut — správa zákaziek a online objednávky.',
    demo: '',
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
    price: 12,
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
    price: 29,
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
