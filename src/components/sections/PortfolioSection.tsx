'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { PORTFOLIO_ITEMS } from '@/lib/constants';

function ExternalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M7 3H3v10h10V9M9 3h4v4M9 7l4-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PortfolioSection() {
  const t = useTranslations('portfolio');

  return (
    <section id="portfolio" className="scroll-reveal bg-[--color-bg] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <Badge variant="primary">{t('label')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[--color-text-muted]">
            {t('subtitle')}
          </p>
        </div>

        {/* Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PORTFOLIO_ITEMS.map((item, i) => {
            const descKey = item.descKey.replace('portfolio.', '') as
              | 'krajina' | 'adriano' | 'barbershop' | 'ljservis'
              | 'krokshop' | 'dentcare' | 'zenflow' | 'ember' | 'transport';
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-card] transition-all hover:-translate-y-1 hover:shadow-xl hover:border-primary/30"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Emoji visual */}
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[--color-card] to-[--color-card-hover] text-7xl transition-transform duration-500 group-hover:scale-110">
                  {item.screenshotPlaceholder}
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col p-5">
                  {/* Title + arrow */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white">{item.name}</h3>
                    <span className="text-[--color-text-muted] opacity-0 transition-opacity group-hover:opacity-100">
                      <ExternalIcon />
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[--color-text-muted]">
                    {t(descKey)}
                  </p>

                  {/* Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-4 border-t border-[--color-border] pt-4">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                      {t('viewDemo')}
                      <ExternalIcon />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* View all — placeholder */}
        <div className="mt-10 text-center">
          <a
            href="https://wa.me/421901234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            {t('viewAll')}
          </a>
        </div>
      </div>
    </section>
  );
}
