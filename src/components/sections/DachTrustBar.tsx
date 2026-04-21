import { useTranslations } from 'next-intl';

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="10" cy="10" rx="3.5" ry="8.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 10h17M10 1.5c-2 2.5-3 5-3 8.5s1 6 3 8.5M10 1.5c2 2.5 3 5 3 8.5s-1 6-3 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L3 5v5c0 4.1 2.9 7.9 7 9 4.1-1.1 7-4.9 7-9V5l-7-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 8h16" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 12h3M14 12h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const BADGES = [
  { key: 'badge1', Icon: GlobeIcon },
  { key: 'badge2', Icon: ShieldIcon },
  { key: 'badge3', Icon: LockIcon },
  { key: 'badge4', Icon: CreditCardIcon },
] as const;

export default function DachTrustBar() {
  const t = useTranslations('dachTrust');

  return (
    <section className="border-y border-[--color-border] bg-[--color-card] py-4 sm:py-5">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
          {BADGES.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-2 text-sm font-medium text-[--color-text-muted]">
              <span className="text-[--color-primary]">
                <Icon />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
