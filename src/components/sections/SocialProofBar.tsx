import { useTranslations } from 'next-intl';
import { STATS } from '@/lib/constants';

export default function SocialProofBar() {
  const t = useTranslations('stats');

  return (
    <section className="border-y border-white/5 bg-secondary py-8 sm:py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {STATS.map((stat) => {
            const labelKey = stat.labelKey.replace('stats.', '');
            return (
              <div key={stat.labelKey} className="text-center">
                <p className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl lg:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/50 sm:text-sm">
                  {t(labelKey as 'projects' | 'delivery' | 'rating' | 'from')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
