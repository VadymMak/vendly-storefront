'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

function IconSparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l5.4-3.1A.5.5 0 0122 7.4v9.2a.5.5 0 01-.6.5L16 14" />
    </svg>
  );
}

function IconWand() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.86a8.18 8.18 0 004.78 1.52V6.93a4.85 4.85 0 01-1.01-.24z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

const CARDS = [
  { key: 'images', icon: <IconSparkle /> },
  { key: 'video',  icon: <IconVideo /> },
  { key: 'tools',  icon: <IconWand /> },
] as const;

export default function AIStudioSection() {
  const t = useTranslations('aiStudio');

  return (
    <section className="relative overflow-hidden bg-[--color-bg] py-20 sm:py-28">
      {/* Green radial glow — makes this section feel distinct */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[700px] w-[700px] rounded-full bg-[--color-primary] opacity-[0.05] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[--color-primary] bg-[--color-accent] px-3 py-1 text-xs font-semibold tracking-widest text-[--color-primary]">
            <IconSparkle />
            {t('badge')}
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[--color-text-muted] sm:text-lg">
            {t('subtitle')}
          </p>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {CARDS.map(({ key, icon }) => (
            <div
              key={key}
              className="group flex flex-col gap-4 rounded-2xl border border-[--color-border] bg-[--color-card] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[--color-primary]/40 hover:shadow-lg hover:shadow-[--color-primary]/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[--color-accent] text-[--color-primary] transition-colors duration-200 group-hover:bg-[--color-primary] group-hover:text-white">
                {icon}
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-semibold text-white">
                  {t(`cards.${key}.title` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm leading-relaxed text-[--color-text-muted]">
                  {t(`cards.${key}.description` as Parameters<typeof t>[0])}
                </p>
              </div>
              <p className="mt-auto text-xs font-medium text-[--color-primary]">
                {t(`cards.${key}.price` as Parameters<typeof t>[0])}
              </p>
            </div>
          ))}
        </div>

        {/* Social platforms row */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="flex items-center gap-3 text-[--color-text-muted]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[--color-border] bg-[--color-card]">
              <IconInstagram />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[--color-border] bg-[--color-card]">
              <IconTikTok />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[--color-border] bg-[--color-card]">
              <IconYouTube />
            </span>
          </div>
          <p className="text-sm text-[--color-text-muted]">{t('social.text')}</p>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-[--color-primary] px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[--color-primary-dark]"
          >
            <IconSparkle />
            {t('cta.button')}
          </Link>
          <p className="text-sm text-[--color-text-dim]">{t('cta.note')}</p>
        </div>

      </div>
    </section>
  );
}
