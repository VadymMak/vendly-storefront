'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';

const STEP_ICONS: Record<string, React.ReactNode> = {
  register: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="14" cy="10" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 24c0-5 4-9 9-9s9 4 9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 8l2-2m0 0h-3m3 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  customize: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h20" stroke="currentColor" strokeWidth="1.8" />
      <rect x="7" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 13h5M16 17h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="7" r="1" fill="#ef4444" />
      <circle cx="10" cy="7" r="1" fill="#eab308" />
      <circle cx="13" cy="7" r="1" fill="#22c55e" />
    </svg>
  ),
  sell: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 22V10l8-6 8 6v12a2 2 0 01-2 2H8a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11 24v-7h6v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 4v0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="21" cy="7" r="3.5" fill="#22c55e" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20 7h2M21 6v2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

function StepArrow() {
  return (
    <div className="hidden items-center justify-center md:flex">
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="text-primary/30">
        <path d="M0 12h40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M36 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const STEPS = [
  { id: 'register', step: 1, titleKey: 'step1Title', descKey: 'step1Desc' },
  { id: 'customize', step: 2, titleKey: 'step2Title', descKey: 'step2Desc' },
  { id: 'sell', step: 3, titleKey: 'step3Title', descKey: 'step3Desc' },
] as const;

export default function HowItWorks() {
  const t = useTranslations('howItWorks');

  return (
    <section id="how-it-works" className="scroll-reveal bg-accent py-20">
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

        {/* Steps grid with arrows */}
        <div className="mt-16 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {STEPS.map((step, i) => (
            <Fragment key={step.id}>
              <div
                className="animate-fade-in-up rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                {/* Step number */}
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {step.step}
                </div>

                {/* Icon */}
                <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-primary">
                  {STEP_ICONS[step.id]}
                </div>

                <h3 className="mt-5 text-xl font-semibold text-secondary">
                  {t(step.titleKey)}
                </h3>

                <p className="mt-3 text-neutral leading-relaxed">
                  {t(step.descKey)}
                </p>
              </div>

              {/* Arrow between steps (not after the last one) */}
              {i < STEPS.length - 1 && (
                <StepArrow />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
