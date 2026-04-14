'use client';

import { useTranslations } from 'next-intl';
import { PORTFOLIO_ITEMS } from '@/lib/constants';

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L2 22l5.13-1.34C8.46 21.52 10.19 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.23 14.19c-.22.62-1.3 1.18-1.78 1.26-.48.08-1.07.12-1.72-.12-.4-.14-.91-.33-1.56-.61-2.72-1.17-4.5-3.9-4.64-4.08-.14-.18-1.1-1.46-1.1-2.78 0-1.32.69-1.97 1-2.28.3-.31.62-.36.83-.36.2 0 .41 0 .59.01.19.01.45-.07.71.54.26.62.87 2.1.94 2.25.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.38-.44.52-.14.14-.29.3-.12.57.16.27.73 1.2 1.58 1.94 1.08.96 1.99 1.26 2.27 1.4.28.14.45.12.62-.07.17-.19.72-.83.91-1.12.19-.29.38-.24.64-.14.26.1 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.72-.15 1.34z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M5.5 2H2v9h9V7.5M7.5 2H11v3.5M7.5 5.5L11 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HeroSection() {
  const t = useTranslations('hero');
  const previewItems = PORTFOLIO_ITEMS.slice(0, 4);

  return (
    <section className="relative overflow-hidden bg-secondary pt-16 pb-20 sm:pt-20 sm:pb-28">
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 -translate-x-1/3 translate-y-1/3 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* ── Left — text ── */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t('badge')}
              </span>
            </div>

            {/* Heading */}
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
              {t('title')}{' '}
              <span className="text-primary">{t('titleHighlight')}</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
              {t('subtitle')}
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="https://wa.me/421901234567"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark sm:text-base"
              >
                <WhatsAppIcon />
                {t('cta1')}
              </a>
              <a
                href="#portfolio"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/10 sm:text-base"
              >
                {t('cta2')}
                <ArrowRightIcon />
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-8 flex flex-wrap gap-4 text-xs text-white/40">
              <span>✓ Bez zálohy</span>
              <span>✓ Hotové za 48h</span>
              <span>✓ Platíte len ak sa páči</span>
            </div>
          </div>

          {/* ── Right — portfolio mini-grid ── */}
          <div className="mt-12 lg:mt-0">
            <div className="grid grid-cols-2 gap-4">
              {previewItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-white/8"
                >
                  {/* Emoji visual */}
                  <div className="flex h-28 items-center justify-center transition-all duration-500 group-hover:scale-110 sm:h-36">
                    <span className="text-6xl opacity-75 group-hover:opacity-100 sm:text-7xl">
                      {item.screenshotPlaceholder}
                    </span>
                  </div>
                  {/* Card footer */}
                  <div className="border-t border-white/8 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <span className="text-white/40 transition-colors group-hover:text-primary">
                        <ExternalIcon />
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-white/30">
              9+ projektov • 48h dodanie • 4.9★ hodnotenie
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
