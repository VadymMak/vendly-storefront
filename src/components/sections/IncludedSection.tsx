'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { INCLUDED_FEATURES } from '@/lib/constants';

export default function IncludedSection() {
  const t = useTranslations('included');

  return (
    <section id="included" className="scroll-reveal bg-[--color-bg-alt] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <Badge variant="primary">{t('label')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
        </div>

        {/* Feature cards — 2×3 grid */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED_FEATURES.map((feature, i) => {
            const titleKey = feature.titleKey.replace('included.', '');
            const descKey = feature.descKey.replace('included.', '');
            return (
              <div
                key={feature.id}
                className="group rounded-2xl border border-[--color-border] bg-[--color-card] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
              >
                {/* Icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[--color-bg] text-2xl transition-colors duration-300 group-hover:bg-primary/10">
                  {feature.icon}
                </div>

                <h3 className="mt-4 text-base font-semibold text-white">
                  {t(titleKey as 'responsive.title' | 'seo.title' | 'ai.title' | 'whatsapp.title' | 'multilang.title' | 'hosting.title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[--color-text-muted]">
                  {t(descKey as 'responsive.desc' | 'seo.desc' | 'ai.desc' | 'whatsapp.desc' | 'multilang.desc' | 'hosting.desc')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
