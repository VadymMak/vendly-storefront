'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { PROCESS_STEPS } from '@/lib/constants';

function StepArrow() {
  return (
    <div className="hidden items-center justify-center md:flex">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M8 16h16M20 10l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary/30"
        />
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const t = useTranslations('process');

  return (
    <section id="how-it-works" className="scroll-reveal bg-[--color-bg-alt] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <Badge variant="primary">{t('label')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
        </div>

        {/* Steps */}
        <div className="mt-16 grid items-stretch gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {PROCESS_STEPS.map((step, i) => {
            const titleKey = step.titleKey.replace('process.', '') as `step${1 | 2 | 3}.title`;
            const descKey = step.descKey.replace('process.', '') as `step${1 | 2 | 3}.desc`;
            return (
              <Fragment key={step.id}>
                <div className="flex flex-col items-center rounded-2xl border border-[--color-border] bg-[--color-card] p-6 text-center shadow-sm sm:p-8">
                  {/* Step number */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {step.step}
                  </div>
                  {/* Icon */}
                  <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-xl bg-[--color-bg] text-4xl">
                    {step.icon}
                  </div>
                  {/* Text */}
                  <h3 className="mt-5 text-xl font-semibold text-white">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-3 leading-relaxed text-[--color-text-muted]">
                    {t(descKey)}
                  </p>
                  {/* CTA button on step 1 */}
                  {i === 0 && (
                    <button
                      onClick={() => window.dispatchEvent(new Event('open-vendshop-chat'))}
                      className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95"
                    >
                      {t('step1.cta')}
                    </button>
                  )}
                </div>
                {i < PROCESS_STEPS.length - 1 && <StepArrow />}
              </Fragment>
            );
          })}
        </div>

        {/* Zero-risk note */}
        <p className="mt-10 text-center text-sm font-medium text-[--color-text-muted]">
          💚 Nulové riziko — platíte len ak ste spokojní s výsledkom
        </p>
      </div>
    </section>
  );
}
