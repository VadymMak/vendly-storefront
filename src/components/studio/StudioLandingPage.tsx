'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconSparkle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l5.4-3.1A.5.5 0 0122 7.4v9.2a.5.5 0 01-.6.5L16 14" />
    </svg>
  );
}

function IconMotion() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBrush() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L4.22 13.45a2 2 0 000 2.83l3.5 3.5a2 2 0 002.83 0l8.84-8.84a5.5 5.5 0 000-7.33z" />
      <path d="M7.5 21c-1.5.5-4.5.5-4.5-1.5 0-1.5 1.5-3 3-3s3 1.5 3 3c0 .5-.17 1-.5 1.5z" />
    </svg>
  );
}

function IconZoom() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  );
}

function IconFace() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Social platform icons
function IconInstagram() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.86a8.18 8.18 0 004.78 1.52V6.93a4.85 4.85 0 01-1.01-.24z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const TOOLS = [
  { key: 'textToImage',  icon: <IconSparkle /> },
  { key: 'textToVideo',  icon: <IconVideo /> },
  { key: 'imageToVideo', icon: <IconMotion /> },
  { key: 'aiEdit',       icon: <IconBrush /> },
  { key: 'upscale',      icon: <IconZoom /> },
  { key: 'faceEnhance',  icon: <IconFace /> },
  { key: 'removeBg',     icon: <IconScissors /> },
] as const;

const PRESETS = [
  { label: 'Instagram Reel',  ratio: '9:16', duration: '5s',  icon: <IconInstagram />, color: 'from-pink-500 to-purple-500' },
  { label: 'Instagram Story', ratio: '9:16', duration: '5s',  icon: <IconInstagram />, color: 'from-pink-500 to-purple-500' },
  { label: 'Instagram Post',  ratio: '1:1',  duration: '5s',  icon: <IconInstagram />, color: 'from-pink-500 to-purple-500' },
  { label: 'YouTube Shorts',  ratio: '9:16', duration: '10s', icon: <IconYouTube />,   color: 'from-red-500 to-red-600' },
  { label: 'TikTok',          ratio: '9:16', duration: '10s', icon: <IconTikTok />,    color: 'from-neutral-800 to-neutral-900' },
  { label: 'Cinematic',       ratio: '16:9', duration: '10s', icon: <IconVideo />,     color: 'from-blue-600 to-indigo-700' },
  { label: 'Product Showcase',ratio: '1:1',  duration: '5s',  icon: <IconSparkle />,   color: 'from-emerald-600 to-teal-700' },
] as const;

type PlanRow = { label: string; free: string | boolean; starter: string | boolean; pro: string | boolean };

const PLAN_ROWS: PlanRow[] = [
  { label: 'imagesMonth',     free: '5',          starter: '50',          pro: '150' },
  { label: 'videosMonth',     free: '1',          starter: '3',           pro: '8' },
  { label: 'video10s',        free: false,         starter: true,          pro: true },
  { label: 'allTools',        free: true,          starter: true,          pro: true },
  { label: 'creditPacks',     free: true,          starter: true,          pro: true },
  { label: 'websiteBuilder',  free: false,         starter: true,          pro: true },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioLandingPage() {
  const t = useTranslations('studio');

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold tracking-widest text-[var(--color-primary)]">
            <IconSparkle />
            {t('hero.badge')}
          </span>

          {/* Headline */}
          <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('hero.title')}
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-text-muted)]">
            {t('hero.subtitle')}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login?callbackUrl=/studio"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              <IconSparkle />
              {t('hero.cta')}
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--color-card-hover)]"
            >
              {t('hero.ctaSecondary')}
            </a>
          </div>

          {/* Social proof micro-row */}
          <p className="mt-8 text-sm text-[var(--color-text-dim)]">
            No credit card required · 5 free images + 1 video every month
          </p>
        </div>
      </section>

      {/* ── Tools Grid ────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('tools.title')}</h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.map(({ key, icon }) => {
              const toolKey = key as keyof typeof TOOLS[number] extends 'key' ? typeof key : never;
              void toolKey;
              return (
                <div
                  key={key}
                  className="group flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-card-hover)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-[var(--color-primary)]">
                    {icon}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {t(`tools.${key}.title` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {t(`tools.${key}.description` as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-auto text-xs font-medium text-[var(--color-text-dim)]">
                    {t(`tools.${key}.price` as Parameters<typeof t>[0])}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Social Media Presets ──────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg-alt)] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('presets.title')}</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">{t('presets.subtitle')}</p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {PRESETS.map((preset) => (
              <div
                key={preset.label}
                className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center"
              >
                {/* Aspect ratio visual */}
                <div className={`flex items-center justify-center rounded-lg bg-gradient-to-br ${preset.color} p-0.5`}>
                  <div
                    className="flex items-center justify-center rounded-md bg-black/40 text-white"
                    style={{
                      width: preset.ratio === '16:9' ? '64px' : preset.ratio === '9:16' ? '36px' : '48px',
                      height: preset.ratio === '9:16' ? '64px' : preset.ratio === '16:9' ? '36px' : '48px',
                    }}
                  >
                    <span className="opacity-80">{preset.icon}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-white">{preset.label}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-dim)]">
                    {preset.ratio} · {preset.duration}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('howItWorks.title')}</h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {(['1', '2', '3'] as const).map((n) => (
              <div key={n} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-lg font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {t(`howItWorks.step${n}Title` as Parameters<typeof t>[0])}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {t(`howItWorks.step${n}Desc` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[var(--color-bg-alt)] py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('pricing.title')}</h2>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            {/* Header row */}
            <div className="grid grid-cols-4 bg-[var(--color-card)]">
              <div className="p-5" />
              {[
                { key: 'free',    price: '€0',  highlight: false },
                { key: 'starter', price: '€19', highlight: true },
                { key: 'pro',     price: '€39', highlight: false },
              ].map(({ key, price, highlight }) => (
                <div
                  key={key}
                  className={`p-5 text-center ${highlight ? 'bg-[var(--color-accent)]' : ''}`}
                >
                  <p className={`text-sm font-semibold ${highlight ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {t(`pricing.${key}` as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {price}<span className="text-sm font-normal text-[var(--color-text-muted)]">{key !== 'free' ? t('pricing.month') : ''}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Feature rows */}
            {PLAN_ROWS.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-4 border-t border-[var(--color-border)] ${i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-card)]'}`}
              >
                <div className="p-4 text-sm text-[var(--color-text-muted)]">
                  {t(`pricing.${row.label}` as Parameters<typeof t>[0])}
                </div>
                {[row.free, row.starter, row.pro].map((val, j) => (
                  <div key={j} className={`flex items-center justify-center p-4 ${j === 1 ? 'bg-[var(--color-accent)]' : ''}`}>
                    {typeof val === 'boolean' ? (
                      val
                        ? <span className="text-[var(--color-primary)]"><IconCheck /></span>
                        : <span className="text-[var(--color-text-dim)]"><IconX /></span>
                    ) : (
                      <span className="text-sm font-medium text-white">{val}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* CTA row */}
            <div className="grid grid-cols-4 border-t border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="p-5" />
              {[
                { cta: t('pricing.tryCta'),   href: '/login?callbackUrl=/studio', highlight: false },
                { cta: t('pricing.startCta'), href: '/login?callbackUrl=/studio', highlight: true },
                { cta: t('pricing.startCta'), href: '/login?callbackUrl=/studio', highlight: false },
              ].map(({ cta, href, highlight }, i) => (
                <div key={i} className={`flex items-center justify-center p-5 ${highlight ? 'bg-[var(--color-accent)]' : ''}`}>
                  <Link
                    href={href}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      highlight
                        ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                        : 'border border-[var(--color-border)] text-white hover:bg-[var(--color-card-hover)]'
                    }`}
                  >
                    {cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Credit packs note */}
          <p className="mt-6 text-center text-sm text-[var(--color-text-dim)]">
            {t('pricing.creditNote')}
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{t('cta.title')}</h2>
          <p className="mt-4 text-lg text-[var(--color-text-muted)]">{t('cta.subtitle')}</p>
          <Link
            href="/login?callbackUrl=/studio"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-10 py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            <IconSparkle />
            {t('cta.button')}
          </Link>
        </div>
      </section>

      {/* ── BYOK note ────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--color-border)] py-6">
        <p className="text-center text-xs text-[var(--color-text-dim)]">
          {t('byok.note')}
        </p>
      </div>

    </main>
  );
}
