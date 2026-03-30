import type { WeekSchedule, OrderAcceptanceSchedule, ColorSchemeTokens } from '@/lib/types';
import { DAY_KEYS } from '@/lib/constants';

// Day label translations for the shop storefront (by shopLanguage)
const DAY_LABELS: Record<string, Record<string, string>> = {
  mon: { sk: 'Po', en: 'Mon', uk: 'Пн', cs: 'Po', de: 'Mo' },
  tue: { sk: 'Ut', en: 'Tue', uk: 'Вт', cs: 'Út', de: 'Di' },
  wed: { sk: 'St', en: 'Wed', uk: 'Ср', cs: 'St', de: 'Mi' },
  thu: { sk: 'Št', en: 'Thu', uk: 'Чт', cs: 'Čt', de: 'Do' },
  fri: { sk: 'Pi', en: 'Fri', uk: 'Пт', cs: 'Pá', de: 'Fr' },
  sat: { sk: 'So', en: 'Sat', uk: 'Сб', cs: 'So', de: 'Sa' },
  sun: { sk: 'Ne', en: 'Sun', uk: 'Нд', cs: 'Ne', de: 'So' },
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  open:   { sk: 'Otvorené',  en: 'Open',   uk: 'Відчинено', cs: 'Otevřeno', de: 'Geöffnet' },
  closed: { sk: 'Zatvorené', en: 'Closed',  uk: 'Зачинено',  cs: 'Zavřeno',  de: 'Geschlossen' },
  until:  { sk: 'do',        en: 'until',   uk: 'до',        cs: 'do',       de: 'bis' },
  orders: { sk: 'Objednávky', en: 'Orders', uk: 'Замовлення', cs: 'Objednávky', de: 'Bestellungen' },
  closedLabel: { sk: 'Zatvorené', en: 'Closed', uk: 'Зачинено', cs: 'Zavřeno', de: 'Geschlossen' },
};

function getLabel(key: string, lang: string, map: Record<string, Record<string, string>>): string {
  return map[key]?.[lang] || map[key]?.['en'] || key;
}

/** Returns 0=Monday … 6=Sunday from JS Date (which gives 0=Sunday) */
function getIsoDay(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function isTimeInRange(now: string, from: string, to: string, breakFrom?: string, breakTo?: string): boolean {
  if (now < from || now >= to) return false;
  if (breakFrom && breakTo && now >= breakFrom && now < breakTo) return false;
  return true;
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface StoreStatusProps {
  hours: WeekSchedule;
  orderAcceptance?: OrderAcceptanceSchedule;
  scheme: ColorSchemeTokens;
  shopLanguage: string;
  hasBanner?: boolean;
}

export default function StoreStatus({ hours, orderAcceptance, scheme, shopLanguage, hasBanner }: StoreStatusProps) {
  const now = new Date();
  const dayIdx = getIsoDay(now);
  const today = hours[dayIdx];
  const currentTime = getCurrentTime();
  const lang = shopLanguage;

  const isOpen = today.open && isTimeInRange(currentTime, today.from, today.to, today.breakFrom, today.breakTo);
  const isOnBreak = today.open && today.breakFrom && today.breakTo && currentTime >= today.breakFrom && currentTime < today.breakTo;

  const chipBase = hasBanner
    ? 'bg-white/20 text-white backdrop-blur-sm'
    : `${scheme.chipBg} ${scheme.chipText}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. Today's hours — shortest badge on top */}
      {today.open && (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${chipBase}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {today.from}–{today.to}
          {today.breakFrom && today.breakTo && (
            <span className="opacity-70">({today.breakFrom}–{today.breakTo})</span>
          )}
        </span>
      )}

      {/* 2. Open / Closed badge — medium length */}
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
        isOpen
          ? hasBanner ? 'bg-green-500/80 text-white backdrop-blur-sm' : 'bg-green-100 text-green-700'
          : hasBanner ? 'bg-red-500/60 text-white backdrop-blur-sm' : 'bg-red-100 text-red-600'
      }`}>
        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        {isOpen
          ? `${getLabel('open', lang, STATUS_LABELS)} ${getLabel('until', lang, STATUS_LABELS)} ${isOnBreak ? today.breakTo : today.to}`
          : getLabel('closed', lang, STATUS_LABELS)}
      </span>

      {/* 3. Order acceptance — longest badge at bottom */}
      {orderAcceptance?.enabled && (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${chipBase}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          {getLabel('orders', lang, STATUS_LABELS)}: {orderAcceptance.from}–{orderAcceptance.to}
        </span>
      )}
    </div>
  );
}
