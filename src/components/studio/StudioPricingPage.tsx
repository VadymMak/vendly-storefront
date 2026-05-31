'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

// ── Icons ──────────────────────────────────────────────────────────────────────

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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
    </svg>
  );
}

// ── Plan rows data ─────────────────────────────────────────────────────────────

type CellValue = string | boolean;

interface PlanRow {
  labelKey: string;
  free: CellValue;
  starter: CellValue;
  pro: CellValue;
}

const PLAN_ROWS: PlanRow[] = [
  { labelKey: 'imagesMonth',    free: '5',              starter: '50',           pro: '150' },
  { labelKey: 'videosMonth',    free: '1 (5s only)',    starter: '3',            pro: '8' },
  { labelKey: 'video10s',       free: false,            starter: '2 credits',    pro: '2 credits' },
  { labelKey: 'allTools',       free: true,             starter: true,           pro: true },
  { labelKey: 'promptEnhance',  free: true,             starter: true,           pro: true },
  { labelKey: 'creditPacks',    free: true,             starter: true,           pro: true },
  { labelKey: 'websiteBuilder', free: false,            starter: true,           pro: true },
  { labelKey: 'customDomain',   free: false,            starter: false,          pro: true },
  { labelKey: 'prioritySupport',free: false,            starter: false,          pro: true },
];

// ── Tool pricing rows ──────────────────────────────────────────────────────────

const TOOL_ROWS = [
  'textImage', 'textVideo5', 'textVideo10', 'imageVideo',
  'aiEdit', 'upscale', 'faceEnhance', 'removeBg',
] as const;

// ── FAQ items ──────────────────────────────────────────────────────────────────

const FAQ_KEYS = ['howCredits', 'runOut', 'freePlan', 'byok', 'compare'] as const;

// ── Cell renderer ──────────────────────────────────────────────────────────────

function Cell({ value, highlight }: { value: CellValue; highlight: boolean }) {
  const base = `flex items-center justify-center p-4 text-sm ${highlight ? 'bg-[var(--color-accent)]' : ''}`;
  if (typeof value === 'boolean') {
    return (
      <div className={base}>
        {value
          ? <span className="text-[var(--color-primary)]"><IconCheck /></span>
          : <span className="text-[var(--color-text-dim)]"><IconX /></span>
        }
      </div>
    );
  }
  return (
    <div className={base}>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

// ── FAQ Accordion item ─────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium text-white hover:text-[var(--color-primary)] transition-colors"
      >
        {q}
        <IconChevron open={open} />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-[var(--color-text-muted)]">{a}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudioPricingPage() {
  const t = useTranslations('studioPricing');

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--color-text-muted)]">
            {t('hero.subtitle')}
          </p>
        </div>
      </section>

      {/* ── Plan comparison ─────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg-alt)] py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

          {/* Plan header cards — stacked on mobile, columns on desktop */}
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {/* Free */}
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-center sm:p-6">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">{t('plans.free.name')}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{t('plans.free.price')}</p>
              <Link
                href="/login?callbackUrl=/studio"
                className="mt-5 w-full rounded-lg border border-[var(--color-border)] py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-card-hover)]"
              >
                {t('plans.free.cta')}
              </Link>
            </div>

            {/* Starter — highlighted */}
            <div className="relative flex flex-col items-center rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-5 text-center shadow-lg shadow-[var(--color-primary)]/10 sm:p-6">
              <span className="absolute -top-3.5 rounded-full bg-[var(--color-primary)] px-3 py-0.5 text-xs font-bold text-white">
                {t('plans.badge')}
              </span>
              <p className="text-sm font-semibold text-[var(--color-primary)]">{t('plans.starter.name')}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {t('plans.starter.price')}<span className="text-sm font-normal text-[var(--color-text-muted)]">{t('plans.starter.period')}</span>
              </p>
              <Link
                href="/pricing"
                className="mt-5 w-full rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                {t('plans.starter.cta')}
              </Link>
            </div>

            {/* Pro */}
            <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-center sm:p-6">
              <p className="text-sm font-semibold text-[var(--color-text-muted)]">{t('plans.pro.name')}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {t('plans.pro.price')}<span className="text-sm font-normal text-[var(--color-text-muted)]">{t('plans.pro.period')}</span>
              </p>
              <Link
                href="/pricing"
                className="mt-5 w-full rounded-lg border border-[var(--color-border)] py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-card-hover)]"
              >
                {t('plans.pro.cta')}
              </Link>
            </div>
          </div>

          {/* Feature rows table */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            {PLAN_ROWS.map((row, i) => (
              <div
                key={row.labelKey}
                className={`grid grid-cols-4 border-b border-[var(--color-border)] last:border-b-0 ${i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-card)]'}`}
              >
                <div className="flex items-center p-4 text-sm text-[var(--color-text-muted)]">
                  {t(`plans.rows.${row.labelKey}` as Parameters<typeof t>[0])}
                </div>
                <Cell value={row.free}    highlight={false} />
                <Cell value={row.starter} highlight={true} />
                <Cell value={row.pro}     highlight={false} />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Credit packs ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('packs.title')}</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">{t('packs.subtitle')}</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {/* Pack S */}
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <div>
                <p className="text-lg font-bold text-white">{t('packs.s.name')}</p>
                <p className="mt-1 text-3xl font-extrabold text-white">{t('packs.s.price')}</p>
              </div>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>{t('packs.s.images')}</li>
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>{t('packs.s.videos')}</li>
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>Credits never expire</li>
              </ul>
              <Link
                href="/login?callbackUrl=/studio"
                className="mt-auto rounded-lg border border-[var(--color-border)] py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--color-card-hover)]"
              >
                {t('packs.s.cta')}
              </Link>
            </div>

            {/* Pack L — best value */}
            <div className="relative flex flex-col gap-4 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-6 shadow-lg shadow-[var(--color-primary)]/10">
              <span className="absolute -top-3.5 right-5 rounded-full bg-[var(--color-primary)] px-3 py-0.5 text-xs font-bold text-white">
                {t('packs.l.badge')}
              </span>
              <div>
                <p className="text-lg font-bold text-white">{t('packs.l.name')}</p>
                <p className="mt-1 text-3xl font-extrabold text-white">{t('packs.l.price')}</p>
              </div>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>{t('packs.l.images')}</li>
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>{t('packs.l.videos')}</li>
                <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]"><IconCheck /></span>Credits never expire</li>
              </ul>
              <Link
                href="/login?callbackUrl=/studio"
                className="mt-auto rounded-lg bg-[var(--color-primary)] py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                {t('packs.l.cta')}
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--color-text-dim)]">{t('packs.note')}</p>
        </div>
      </section>

      {/* ── Per-tool pricing ─────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg-alt)] py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('toolPricing.title')}</h2>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t('toolPricing.subtitle')}</p>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">{t('toolPricing.columns.tool')}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">{t('toolPricing.columns.description')}</span>
              <span className="text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">{t('toolPricing.columns.cost')}</span>
            </div>

            {TOOL_ROWS.map((key, i) => (
              <div
                key={key}
                className={`grid grid-cols-3 items-center border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0 ${i % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-card)]'}`}
              >
                <span className="text-sm font-medium text-white">
                  {t(`toolPricing.tools.${key}.name` as Parameters<typeof t>[0])}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t(`toolPricing.tools.${key}.desc` as Parameters<typeof t>[0])}
                </span>
                <span className="text-right text-sm font-semibold text-[var(--color-primary)]">
                  {t(`toolPricing.tools.${key}.cost` as Parameters<typeof t>[0])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BYOK section ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-[var(--color-primary)]">
              <IconKey />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{t('byok.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{t('byok.description')}</p>
            </div>
            <Link
              href="/login?callbackUrl=/studio"
              className="shrink-0 rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-card-hover)]"
            >
              {t('byok.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-bg-alt)] py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t('faq.title')}</h2>
          <div className="mt-8">
            {FAQ_KEYS.map((key) => (
              <FaqItem
                key={key}
                q={t(`faq.items.${key}.q` as Parameters<typeof t>[0])}
                a={t(`faq.items.${key}.a` as Parameters<typeof t>[0])}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{t('cta.title')}</h2>
          <p className="mt-4 text-[var(--color-text-muted)]">{t('cta.note')}</p>
          <Link
            href="/login?callbackUrl=/studio"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-10 py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>

    </main>
  );
}
