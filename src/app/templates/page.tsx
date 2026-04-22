'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { TEMPLATE_ITEMS } from '@/lib/constants';

const FILTER_TYPES = [
  'all',
  'food',
  'restaurant',
  'beauty',
  'wellness',
  'repair',
  'home_services',
  'health',
  'ecommerce',
  'medical',
  'nightlife',
  'photography',
  'fashion',
  'physical',
  'digital',
  'events',
] as const;

// Maps template id → best-matching businessType id in /create
const TEMPLATE_CREATE_TYPE: Record<string, string> = {
  classic:  'auto',
  warm:     'restaurant',
  natural:  'beauty',
  bold:     'agency',
  dark:     'photography',
  medical:  'dentist',
};

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.25 2.333H2.333A1.167 1.167 0 0 0 1.167 3.5v8.167c0 .644.522 1.166 1.166 1.166H10.5c.644 0 1.167-.522 1.167-1.166V8.75M8.167 1.167H12.833M12.833 1.167v4.666M12.833 1.167 5.833 8.167" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TemplatesPage() {
  const t = useTranslations('templatesPage');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filtered = activeFilter === 'all'
    ? TEMPLATE_ITEMS
    : TEMPLATE_ITEMS.filter((tpl) => tpl.businessTypes.includes(activeFilter));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[--color-bg]">
        {/* Hero */}
        <section className="py-20 sm:py-28 text-center px-4">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-[--color-primary]/30 bg-[--color-primary]/10 px-4 py-1.5 text-sm font-medium text-[--color-primary]">
              {t('badge')}
            </span>
            <h1 className="mt-5 text-4xl font-bold text-white sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-5 text-lg text-[--color-text-muted] max-w-xl mx-auto">
              {t('subtitle')}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap justify-center gap-2">
              {FILTER_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeFilter === type
                      ? 'bg-[--color-primary] text-white'
                      : 'border border-[--color-border] text-[--color-text-muted] hover:border-[--color-primary]/50 hover:text-white'
                  }`}
                >
                  {t(`filter.${type}`)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-5xl">
            {filtered.length === 0 ? (
              <p className="text-center text-[--color-text-muted] py-16">{t('noResults')}</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tpl) => {
                  const nameKey = tpl.nameKey.replace('templates.', '').replace('.name', '') as string;
                  const descKey = tpl.descKey.replace('templates.', '').replace('.desc', '') as string;

                  return (
                    <div
                      key={tpl.id}
                      className="group relative rounded-2xl border border-[--color-border] bg-[--color-card] overflow-hidden transition-all hover:border-[--color-primary]/40 hover:shadow-lg hover:shadow-[--color-primary]/5"
                    >
                      {/* Color preview bar */}
                      <div
                        className="h-2 w-full"
                        style={{ backgroundColor: tpl.palette }}
                      />

                      {/* Preview area */}
                      <div
                        className="relative flex items-center justify-center h-44 text-6xl"
                        style={{ backgroundColor: `${tpl.palette}18` }}
                      >
                        <span>{tpl.emoji}</span>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[--color-bg]/80">
                          <a
                            href={tpl.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[--color-primary] px-5 py-2 text-sm font-semibold text-white hover:bg-[--color-primary-dark] transition-colors"
                          >
                            {t('preview')} <ExternalIcon />
                          </a>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-5">
                        <h3 className="text-base font-semibold text-white capitalize">
                          {t(`${nameKey}.name` as Parameters<typeof t>[0])}
                        </h3>
                        <p className="mt-1 text-sm text-[--color-text-muted]">
                          {t(`${descKey}.desc` as Parameters<typeof t>[0])}
                        </p>

                        {/* Business type tags */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {tpl.businessTypes.map((bt) => (
                            <span
                              key={bt}
                              className="rounded-full px-2.5 py-0.5 text-xs border border-[--color-border] text-[--color-text-dim]"
                            >
                              {t(`filter.${bt}`)}
                            </span>
                          ))}
                        </div>

                        {/* CTAs */}
                        <div className="mt-4 flex flex-col gap-2">
                          <a
                            href={`/create?type=${TEMPLATE_CREATE_TYPE[tpl.id] ?? 'auto'}`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[--color-primary] py-2 text-sm font-semibold text-white hover:bg-[--color-primary-dark] transition-colors"
                          >
                            {t('useTemplate')} →
                          </a>
                          <a
                            href={tpl.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[--color-border] py-2 text-sm font-medium text-[--color-text-muted] hover:border-[--color-primary]/40 hover:text-white transition-colors"
                          >
                            {t('viewDemo')} <ExternalIcon />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
