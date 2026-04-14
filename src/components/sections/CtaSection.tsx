'use client';

import { useTranslations } from 'next-intl';

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L2 22l5.13-1.34C8.46 21.52 10.19 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.23 14.19c-.22.62-1.3 1.18-1.78 1.26-.48.08-1.07.12-1.72-.12-.4-.14-.91-.33-1.56-.61-2.72-1.17-4.5-3.9-4.64-4.08-.14-.18-1.1-1.46-1.1-2.78 0-1.32.69-1.97 1-2.28.3-.31.62-.36.83-.36.2 0 .41 0 .59.01.19.01.45-.07.71.54.26.62.87 2.1.94 2.25.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.31.38-.44.52-.14.14-.29.3-.12.57.16.27.73 1.2 1.58 1.94 1.08.96 1.99 1.26 2.27 1.4.28.14.45.12.62-.07.17-.19.72-.83.91-1.12.19-.29.38-.24.64-.14.26.1 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.72-.15 1.34z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function CtaSection() {
  const t = useTranslations('cta');

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-secondary py-16 sm:py-24"
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          {t('title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
          {t('subtitle')}
        </p>

        {/* Buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://wa.me/421901234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-lg bg-white px-7 py-3.5 font-semibold text-primary shadow-lg transition-colors hover:bg-white/90"
          >
            <WhatsAppIcon />
            {t('whatsapp')}
          </a>
          <a
            href="mailto:info@vendshop.shop"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 hover:border-white/50"
          >
            <MailIcon />
            {t('form')}
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-white/50">
          <span>✓ {t('free')}</span>
          <span>✓ {t('noCard')}</span>
          <span>✓ {t('fast')}</span>
        </div>
      </div>
    </section>
  );
}
