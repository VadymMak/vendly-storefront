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
  events: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="16" cy="10" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 27h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 10.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
    <section id="about" className="scroll-reveal bg-green-50/40 py-20">
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
          {BUSINESS_TYPES.map((type) => {
            const hasDemo = !!type.demo;
            const Wrapper = hasDemo ? 'a' : 'div';
            const wrapperProps = hasDemo
              ? { href: `/browse?type=${type.id}` }
              : {};

            return (
              <Wrapper
                key={type.id}
                {...wrapperProps}
                className={`group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 sm:p-6 ${
                  hasDemo
                    ? 'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5'
                    : ''
                }`}
              >
                {/* Icon circle */}
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary transition-colors duration-300 ${hasDemo ? 'group-hover:bg-primary group-hover:text-white' : ''}`}>
                  {BUSINESS_ICONS[type.id]}
                </div>

                <h3 className="mt-5 text-lg font-semibold text-secondary">
                  {t(`${type.id}_title`)}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-neutral">
                  {t(`${type.id}_desc`)}
                </p>

                {/* Demo link — only if real shops exist */}
                {hasDemo ? (
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary">
                    <span>{t('viewDemo')}</span>
                    <ArrowIcon />
                  </div>
                ) : (
                  <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-neutral">
                    {t('comingSoon')}
                  </div>
                )}
              </Wrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
