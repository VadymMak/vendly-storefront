'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 text-neutral transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0 text-primary"
    >
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 7a2 2 0 013.5 1.5c0 1-1.5 1.5-1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="13" r="0.75" fill="currentColor" />
    </svg>
  );
}

const FAQ_IDS = ['1', '2', '3', '4', '5', '6', '7'] as const;

export default function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  const t = useTranslations('faq');

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="scroll-reveal bg-green-50/40 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <Badge variant="primary">{t('badge')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {FAQ_IDS.map((num) => {
            const isOpen = openId === num;
            return (
              <div
                key={num}
                className={`rounded-xl border transition-all duration-300 ${
                  isOpen
                    ? 'border-primary/30 bg-accent shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => toggle(num)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left cursor-pointer sm:px-6 sm:py-5"
                  aria-expanded={isOpen}
                >
                  <QuestionIcon />
                  <span className="flex-1 font-medium text-secondary">{t(`q${num}`)}</span>
                  <ChevronIcon open={isOpen} />
                </button>

                {isOpen && (
                  <div className="animate-accordion-open overflow-hidden border-t border-primary/10 px-4 text-sm text-neutral leading-relaxed sm:px-6 sm:text-base">
                    {t(`a${num}`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
