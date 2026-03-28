import { QUICK_BADGES } from '@/lib/constants';
import type { ColorSchemeTokens } from '@/lib/types';

// Badge label translations keyed by badgeId → language
const BADGE_LABELS: Record<string, Record<string, string>> = {
  fast_delivery:  { sk: 'Rýchle doručenie',    en: 'Fast delivery',        uk: 'Швидка доставка',        cs: 'Rychlé doručení',        de: 'Schnelle Lieferung' },
  same_day:       { sk: 'Doručenie v ten deň',  en: 'Same day delivery',    uk: 'Доставка в той же день',  cs: 'Doručení tentýž den',    de: 'Lieferung am selben Tag' },
  free_shipping:  { sk: 'Doprava zadarmo',      en: 'Free shipping',        uk: 'Безкоштовна доставка',    cs: 'Doprava zdarma',         de: 'Kostenloser Versand' },
  pay_online:     { sk: 'Platba online',        en: 'Pay online',           uk: 'Оплата онлайн',          cs: 'Platba online',          de: 'Online bezahlen' },
  pay_cash:       { sk: 'Platba v hotovosti',   en: 'Cash on delivery',     uk: 'Оплата готівкою',        cs: 'Platba hotově',          de: 'Barzahlung' },
  paypal:         { sk: 'PayPal',               en: 'PayPal',               uk: 'PayPal',                  cs: 'PayPal',                 de: 'PayPal' },
  pickup:         { sk: 'Osobný odber',         en: 'Store pickup',         uk: 'Самовивіз',              cs: 'Osobní odběr',           de: 'Abholung im Geschäft' },
  warranty:       { sk: 'Záruka',               en: 'Warranty',             uk: 'Гарантія',               cs: 'Záruka',                 de: 'Garantie' },
  eco_friendly:   { sk: 'Ekologické',           en: 'Eco friendly',         uk: 'Екологічне',             cs: 'Ekologické',             de: 'Umweltfreundlich' },
  handmade:       { sk: 'Ručná výroba',         en: 'Handmade',            uk: 'Ручна робота',           cs: 'Ruční výroba',           de: 'Handgemacht' },
  support_24_7:   { sk: 'Podpora 24/7',         en: 'Support 24/7',        uk: 'Підтримка 24/7',         cs: 'Podpora 24/7',           de: 'Support 24/7' },
  returns:        { sk: 'Vrátenie tovaru',       en: 'Easy returns',        uk: 'Повернення товару',      cs: 'Vrácení zboží',          de: 'Einfache Rückgabe' },
  local_product:  { sk: 'Lokálny produkt',      en: 'Local product',       uk: 'Місцевий продукт',       cs: 'Lokální produkt',        de: 'Lokales Produkt' },
  organic:        { sk: 'Bio / Organické',       en: 'Organic',             uk: 'Органічне',              cs: 'Bio / Organické',        de: 'Bio / Organisch' },
  reservation:    { sk: 'Rezervácia',            en: 'Reservation',         uk: 'Резервація',             cs: 'Rezervace',              de: 'Reservierung' },
  discount:       { sk: 'Zľavy',                en: 'Discounts',           uk: 'Знижки',                 cs: 'Slevy',                  de: 'Rabatte' },
};

function getBadgeLabel(badgeId: string, lang: string): string {
  return BADGE_LABELS[badgeId]?.[lang] || BADGE_LABELS[badgeId]?.['en'] || badgeId;
}

interface QuickBadgesStripProps {
  badgeIds: string[];
  scheme: ColorSchemeTokens;
  shopLanguage: string;
}

export default function QuickBadgesStrip({ badgeIds, scheme, shopLanguage }: QuickBadgesStripProps) {
  const activeBadges = QUICK_BADGES.filter((b) => badgeIds.includes(b.id));
  if (activeBadges.length === 0) return null;

  return (
    <section className={`border-b ${scheme.border} ${scheme.bgCard}`}>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {activeBadges.map((badge) => (
            <div key={badge.id} className={`flex items-center gap-2 text-sm font-medium ${scheme.textMuted}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${scheme.chipBg} ${scheme.chipText}`}>
                <BadgeIconShop name={badge.icon} size={16} />
              </span>
              <span>{getBadgeLabel(badge.id, shopLanguage)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Badge icon (inline SVG, no libraries) ────────────────────────────────────
function BadgeIconShop({ name, size = 16 }: { name: string; size?: number }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'truck':
      return <svg {...common}><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case 'gift':
      return <svg {...common}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>;
    case 'credit_card':
      return <svg {...common}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case 'banknote':
      return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>;
    case 'paypal':
      return <svg {...common} fill="currentColor" stroke="none"><path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337z" /></svg>;
    case 'store':
      return <svg {...common}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'leaf':
      return <svg {...common}><path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 17 3.3 17 3.3s1 7.3-3.8 12c-1 1-2.2 2.1-2.2 4.7" /><path d="M6.8 17c.5-1 1-2 2.2-3" /></svg>;
    case 'hand':
      return <svg {...common}><path d="M18 11V6a2 2 0 00-4 0v1M14 10V4a2 2 0 00-4 0v6M10 10.5V2a2 2 0 00-4 0v10" /><path d="M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" /></svg>;
    case 'headset':
      return <svg {...common}><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>;
    case 'refresh':
      return <svg {...common}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>;
    case 'map_pin':
      return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
    case 'sprout':
      return <svg {...common}><path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 00-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'percent':
      return <svg {...common}><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
  }
}
