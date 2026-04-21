import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PricingSection from '@/components/sections/PricingSection';
import { COMPETITOR_TABLE } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricingPage');
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
  };
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="rgba(22,163,74,0.15)" />
      <path d="M5.5 9l2.5 2.5L12.5 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="rgba(220,38,38,0.12)" />
      <path d="M6 12l6-6M12 12L6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function PricingPage() {
  const t = await getTranslations('pricingPage');
  const tc = await getTranslations('competitor');

  return (
    <>
      <Header />
      <main className="bg-[--color-bg]">
        {/* Hero */}
        <section className="py-20 sm:py-28 text-center px-4">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-[--color-primary]/30 bg-[--color-primary]/10 px-4 py-1.5 text-sm font-medium text-[--color-primary]">
              {t('badge')}
            </span>
            <h1 className="mt-5 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-5 text-lg text-[--color-text-muted] max-w-xl mx-auto">
              {t('subtitle')}
            </p>
          </div>
        </section>

        {/* Pricing plans */}
        <PricingSection />

        {/* Comparison table */}
        <section className="py-20 px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-white text-center mb-12">
              {tc('title')}
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-[--color-border]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--color-border] bg-[--color-card]">
                    <th className="px-6 py-4 text-left text-[--color-text-muted] font-medium">{tc('featureCol')}</th>
                    <th className="px-6 py-4 text-center text-[--color-primary] font-semibold">VendShop</th>
                    <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium">{tc('durableCol')}</th>
                    <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium">{tc('wixCol')}</th>
                    <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium">{tc('freelancerCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPETITOR_TABLE.map((row, i) => {
                    const featureKey = row.feature.replace('competitor.', '') as Parameters<typeof tc>[0];
                    const tv = (val: string) => {
                      if (val === '✓' || val === '✗') return val;
                      if (val.startsWith('competitor.')) {
                        return tc(val.replace('competitor.', '') as Parameters<typeof tc>[0]);
                      }
                      return val;
                    };
                    const renderCell = (val: string, highlight?: boolean) => {
                      const v = tv(val);
                      if (v === '✓') return <span className="flex justify-center"><CheckIcon /></span>;
                      if (v === '✗') return <span className="flex justify-center"><NoIcon /></span>;
                      return <span className={highlight ? 'font-semibold text-[--color-primary]' : 'text-[--color-text-dim]'}>{v}</span>;
                    };
                    return (
                      <tr key={i} className={`border-b border-[--color-border] ${i % 2 === 0 ? 'bg-[--color-bg]' : 'bg-[--color-card]'}`}>
                        <td className="px-6 py-4 text-[--color-text-muted]">{tc(featureKey)}</td>
                        <td className="px-6 py-4 text-center">{renderCell(row.vendshop, true)}</td>
                        <td className="px-6 py-4 text-center">{renderCell(row.durable)}</td>
                        <td className="px-6 py-4 text-center">{renderCell(row.wixSquarespace)}</td>
                        <td className="px-6 py-4 text-center">{renderCell(row.freelancer)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ quick links */}
        <section className="py-16 px-4 text-center">
          <p className="text-[--color-text-muted]">
            {t('faqText')}{' '}
            <a href="/#faq" className="text-[--color-primary] underline hover:opacity-80">
              {t('faqLink')}
            </a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
