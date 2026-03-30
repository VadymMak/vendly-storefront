'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

function CheckIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 ${highlighted ? 'text-white' : 'text-primary'}`}
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PLANS = [
  { id: 'free', name: 'Free', price: 0, highlighted: false, featureKeys: ['free_f1', 'free_f2', 'free_f3', 'free_f4', 'free_f5'] },
  { id: 'starter', name: 'Starter', price: 12, highlighted: true, featureKeys: ['starter_f1', 'starter_f2', 'starter_f3', 'starter_f4', 'starter_f5', 'starter_f6', 'starter_f7'] },
  { id: 'pro', name: 'Pro', price: 29, highlighted: false, featureKeys: ['pro_f1', 'pro_f2', 'pro_f3', 'pro_f4', 'pro_f5', 'pro_f6', 'pro_f7', 'pro_f8'] },
] as const;

export default function PricingSection() {
  const t = useTranslations('pricing');

  return (
    <section id="pricing" className="scroll-reveal bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <Badge variant="primary">{t('badge')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            {t('subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-8 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`animate-fade-in-up relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8 ${
                plan.highlighted
                  ? 'border-primary bg-primary shadow-lg shadow-primary/20'
                  : 'border-gray-200 bg-white hover:border-primary/30 hover:shadow-primary/5'
              }`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-4 py-1 text-xs font-semibold text-white shadow-md">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M6 1l1.5 3L11 5l-2.5 2.5.5 3L6 9l-3 1.5.5-3L1 5l3.5-1L6 1z" fill="#facc15" />
                    </svg>
                    {t('popular')}
                  </span>
                </div>
              )}

              <h3 className={`text-lg font-bold ${plan.highlighted ? 'text-white' : 'text-secondary'}`}>
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${plan.highlighted ? 'text-white' : 'text-secondary'}`}>
                  {plan.price === 0 ? '0' : `${plan.price}`}
                </span>
                <div className={`flex flex-col text-sm ${plan.highlighted ? 'text-white/70' : 'text-neutral'}`}>
                  <span>€</span>
                  <span>/{t('month')}</span>
                </div>
              </div>

              <p className={`mt-3 text-sm ${plan.highlighted ? 'text-white/80' : 'text-neutral'}`}>
                {t(`${plan.id}_desc`)}
              </p>

              <div className={`my-6 h-px ${plan.highlighted ? 'bg-white/20' : 'bg-gray-200'}`} />

              <ul className="flex-1 space-y-3">
                {plan.featureKeys.map((fKey) => (
                  <li key={fKey} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon highlighted={plan.highlighted} />
                    <span className={plan.highlighted ? 'text-white' : 'text-secondary'}>
                      {t(fKey)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  variant={plan.highlighted ? 'secondary' : 'outline'}
                  className="w-full"
                  href="#"
                >
                  {t(`${plan.id}_cta`)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
