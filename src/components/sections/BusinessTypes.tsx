'use client';

import { useTranslations } from 'next-intl';
import { BUSINESS_TYPES } from '@/lib/constants';

const BUSINESS_ICONS: Record<string, React.ReactNode> = {
  physical: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 12v14a2 2 0 002 2h18a2 2 0 002-2V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 6h28l-2.5 6H4.5L2 6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 16v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  food: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 16a11 11 0 0122 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 21h26" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 26h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 7V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 9l-1-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 9l1-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  restaurant: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 4v9a4 4 0 004 4h0a4 4 0 004-4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 4v7c0 3-2 6-4 6h0v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  beauty: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 3l2.5 6L25 12l-6.5 3L16 21l-2.5-6L7 12l6.5-3L16 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7" cy="25" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  repair: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 6a7 7 0 00-9.2 9.2L5 20l2 2 2 2 4.8-4.8A7 7 0 0019 6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 6l-4 5-3.5-3.5L16 3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 24l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M24 22v4M22 24h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  digital: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="5" width="24" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 28h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 22v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 12l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="transition-transform group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BusinessTypes() {
  const t = useTranslations('businessTypes');

  return (
    <section id="business-types" className="scroll-reveal bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <h2 className="text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_TYPES.map((type) => (
            <a
              key={type.id}
              href={`https://${type.demo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-6"
            >
              {/* Icon circle */}
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                {BUSINESS_ICONS[type.id]}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-secondary">
                {t(`${type.id}_title`)}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-neutral">
                {t(`${type.id}_desc`)}
              </p>

              {/* Demo link */}
              <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
                <span>{t('viewDemo')}</span>
                <ArrowIcon />
              </div>

              {/* Demo URL badge */}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs text-neutral">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
                  <path d="M1 5h8M5 1c1.2 1.2 2 2.5 2 4s-.8 2.8-2 4c-1.2-1.2-2-2.5-2-4s.8-2.8 2-4z" stroke="currentColor" strokeWidth="0.8" />
                </svg>
                <span>{type.demo}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
