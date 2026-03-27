'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  'ai-descriptions': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 14l1 2.5L21.5 18 19 19l-1 2.5L17 19l-2.5-1L17 16.5 18 14z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  multilang: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  payments: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  whatsapp: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 21l1.5-5.5A9 9 0 1116.5 19L3 21z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 10c.5-1 1-1.5 1.5-1.5s.8.7 1.2 1c.4.3.8.5 1.3.5s1.5.5 1.5 1.5-1 2-2 2h-.5c-1 0-2.5-.8-3.5-2S8.5 9 9 10z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  mobile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6h12M6 18h12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="20" r="0.5" fill="currentColor" />
    </svg>
  ),
  analytics: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 16V10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 16V7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 16V12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M17 16V5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M21 16V9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  security: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'custom-domain': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 11a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const FEATURE_IDS = [
  'aiDescriptions', 'multilang', 'payments', 'whatsapp',
  'mobile', 'analytics', 'security', 'customDomain',
] as const;

export default function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section id="features" className="scroll-reveal bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <Badge variant="primary">{t('badge')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_IDS.map((featureId, i) => (
            <div
              key={featureId}
              className={`group animate-fade-in-up rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6 ${
                i % 2 === 0
                  ? 'border-gray-200 bg-white hover:border-primary/20 hover:shadow-primary/5'
                  : 'border-primary/10 bg-accent hover:border-primary/30 hover:shadow-primary/5'
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ${
                i % 2 === 0
                  ? 'bg-accent text-primary group-hover:bg-primary group-hover:text-white'
                  : 'bg-white text-primary group-hover:bg-primary group-hover:text-white'
              }`}>
                {FEATURE_ICONS[featureId]}
              </div>

              <h3 className="mt-4 text-base font-semibold text-secondary">
                {t(`${featureId}_title`)}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-neutral">
                {t(`${featureId}_desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
