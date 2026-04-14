'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { PACKAGES, COMPETITOR_TABLE } from '@/lib/constants';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function YesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="#dcfce7" />
      <path d="M5.5 9l2.5 2.5L12.5 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="#fee2e2" />
      <path d="M6 12l6-6M12 12L6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PricingSection() {
  const tp = useTranslations('packages');
  const tc = useTranslations('competitor');

  return (
    <section id="pricing" className="scroll-reveal bg-green-50/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <Badge variant="primary">{tp('label')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {tp('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral">
            {tp('subtitle')}
          </p>
        </div>

        {/* Package cards */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-8 lg:grid-cols-3">
          {PACKAGES.map((pkg, i) => {
            const descKey = pkg.description.replace('packages.', '') as `${typeof pkg.id}.desc`;
            const ctaKey = pkg.cta.replace('packages.', '') as `${typeof pkg.id}.cta`;
            const badgeKey = pkg.badge?.replace('packages.', '') as `premium.badge` | undefined;
            const featureKeys = pkg.features.map(
              (f) => f.replace('packages.', '') as `${typeof pkg.id}.f${number}`
            );

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8 ${
                  pkg.highlighted
                    ? 'border-primary bg-primary shadow-xl shadow-primary/20 lg:scale-105'
                    : 'border-gray-200 bg-white hover:border-primary/30'
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Badge */}
                {pkg.highlighted && badgeKey && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-xs font-bold text-white shadow-md">
                      ⭐ {tp(badgeKey)}
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <h3 className={`text-lg font-bold ${pkg.highlighted ? 'text-white' : 'text-secondary'}`}>
                  {pkg.name}
                </h3>

                {/* Price */}
                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${pkg.highlighted ? 'text-white' : 'text-secondary'}`}>
                      {pkg.currency}{pkg.price}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm ${pkg.highlighted ? 'text-white/70' : 'text-neutral'}`}>
                    {tp('oneTime')} + {pkg.currency}{pkg.monthlyPrice} {tp('perMonth')}
                  </p>
                </div>

                {/* Description */}
                <p className={`mt-3 text-sm ${pkg.highlighted ? 'text-white/80' : 'text-neutral'}`}>
                  {tp(descKey)}
                </p>

                <div className={`my-6 h-px ${pkg.highlighted ? 'bg-white/20' : 'bg-gray-200'}`} />

                {/* Features */}
                <ul className="flex-1 space-y-3">
                  {featureKeys.map((fKey) => (
                    <li key={fKey} className="flex items-start gap-2.5 text-sm">
                      <span className={pkg.highlighted ? 'text-white/80 mt-0.5' : 'text-primary mt-0.5'}>
                        <CheckIcon />
                      </span>
                      <span className={pkg.highlighted ? 'text-white' : 'text-secondary'}>
                        {tp(fKey)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-8">
                  <a
                    href="https://wa.me/421901234567"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${
                      pkg.highlighted
                        ? 'bg-white text-primary hover:bg-white/90'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {tp(ctaKey)}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Competitor comparison table */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center">
            <Badge variant="primary">{tc('label')}</Badge>
            <h3 className="mt-4 text-xl font-bold text-secondary sm:text-2xl">
              {tc('title')}
            </h3>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral">
                    Funkcia
                  </th>
                  <th className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      VendShop ✓
                    </span>
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-neutral">Wix</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-neutral">Squarespace</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-neutral">Freelancer</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_TABLE.map((row, i) => {
                  const featureKey = row.feature.replace('competitor.', '') as
                    | 'creation' | 'monthly' | 'aichat' | 'delivery' | 'effort';
                  return (
                    <tr
                      key={row.feature}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                        i === COMPETITOR_TABLE.length - 1 ? 'border-none' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-secondary">
                        {tc(featureKey)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {row.vendshop === '✓' ? (
                          <span className="inline-flex justify-center"><YesIcon /></span>
                        ) : row.vendshop === '✗' ? (
                          <span className="inline-flex justify-center"><NoIcon /></span>
                        ) : (
                          <span className="font-semibold text-primary">{row.vendshop}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-neutral">
                        {row.wix === '✓' ? (
                          <span className="inline-flex justify-center"><YesIcon /></span>
                        ) : row.wix === '✗' ? (
                          <span className="inline-flex justify-center"><NoIcon /></span>
                        ) : row.wix}
                      </td>
                      <td className="px-4 py-4 text-center text-neutral">
                        {row.squarespace === '✓' ? (
                          <span className="inline-flex justify-center"><YesIcon /></span>
                        ) : row.squarespace === '✗' ? (
                          <span className="inline-flex justify-center"><NoIcon /></span>
                        ) : row.squarespace}
                      </td>
                      <td className="px-4 py-4 text-center text-neutral">
                        {row.freelancer === '✓' ? (
                          <span className="inline-flex justify-center"><YesIcon /></span>
                        ) : row.freelancer === '✗' ? (
                          <span className="inline-flex justify-center"><NoIcon /></span>
                        ) : row.freelancer}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
