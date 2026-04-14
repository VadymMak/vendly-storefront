'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { INCLUDED_FEATURES } from '@/lib/constants';

export default function IncludedSection() {
  const t = useTranslations('included');

  return (
    <section id="included" className="scroll-reveal bg-green-50/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <Badge variant="primary">{t('label')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
        </div>

        {/* Feature cards — 2×3 grid */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED_FEATURES.map((feature, i) => {
            const titleKey = feature.titleKey.replace('included.', '');
            const descKey = feature.descKey.replace('included.', '');
            const isAlt = i % 2 !== 0;
            return (
              <div
                key={feature.id}
                className={`group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  isAlt
                    ? 'border-primary/10 bg-accent hover:border-primary/30'
                    : 'border-gray-200 bg-white hover:border-primary/20 hover:shadow-primary/5'
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-colors duration-300 ${
                    isAlt
                      ? 'bg-white group-hover:bg-primary/10'
                      : 'bg-accent group-hover:bg-primary/10'
                  }`}
                >
                  {feature.icon}
                </div>

                <h3 className="mt-4 text-base font-semibold text-secondary">
                  {t(titleKey as 'responsive.title' | 'seo.title' | 'ai.title' | 'whatsapp.title' | 'multilang.title' | 'hosting.title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral">
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
