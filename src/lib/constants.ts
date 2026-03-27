import type { BusinessType, PricingPlan, FaqItem, HowItWorksStep, NavItem } from './types';

export const SITE_NAME = 'VendShop';
export const SITE_URL = 'https://vendshop.shop';
export const SITE_TAGLINE = 'Váš online obchod za 5 minút';

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
    demo: 'smak.vendshop.shop',
  },
  {
    id: 'food',
    icon: '🍕',
    title: 'Jedlo a produkty',
    description: 'Domáce jedlo, pekáreň, farmárske produkty — prijímajte objednávky online.',
    demo: 'food-demo.vendshop.shop',
  },
  {
    id: 'restaurant',
    icon: '🍽️',
    title: 'Reštaurácia',
    description: 'Online menu, rezervácie a objednávky pre vašu reštauráciu alebo kaviareň.',
    demo: 'resto-demo.vendshop.shop',
  },
  {
    id: 'beauty',
    icon: '💅',
    title: 'Krása a wellness',
    description: 'Salón krásy, masáže, kozmetika — online rezervácie a predaj produktov.',
    demo: 'beauty-demo.vendshop.shop',
  },
  {
    id: 'repair',
    icon: '🔧',
    title: 'Opravovňa',
    description: 'Oprava telefónov, počítačov, áut — správa zákaziek a online objednávky.',
    demo: 'repair-demo.vendshop.shop',
  },
  {
    id: 'digital',
    icon: '💻',
    title: 'Digitálne produkty',
    description: 'Kurzy, e-booky, šablóny — predávajte digitálny obsah bez starostí.',
    demo: 'digital-demo.vendshop.shop',
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
