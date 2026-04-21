import { useTranslations } from 'next-intl';
import { COMPETITOR_TABLE } from '@/lib/constants';
import Badge from '@/components/ui/Badge';

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

function CellValue({ value, highlight }: { value: string; highlight?: boolean }) {
  if (value === '✓') return <span className="flex justify-center"><CheckIcon /></span>;
  if (value === '✗') return <span className="flex justify-center"><NoIcon /></span>;
  return (
    <span className={highlight ? 'font-semibold text-[--color-primary]' : 'text-[--color-text-dim]'}>
      {value}
    </span>
  );
}

export default function ComparisonTable() {
  const t = useTranslations('competitor');

  return (
    <section id="comparison" className="scroll-reveal py-20 sm:py-28 bg-[--color-bg]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="primary">{t('badge')}</Badge>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[--color-text-muted]">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-14 overflow-x-auto rounded-2xl border border-[--color-border]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--color-border] bg-[--color-card]">
                <th className="px-6 py-4 text-left text-[--color-text-muted] font-medium min-w-[160px]">
                  {t('featureCol')}
                </th>
                <th className="px-6 py-4 text-center min-w-[120px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[--color-primary]/15 px-3 py-1 text-sm font-semibold text-[--color-primary]">
                    VendShop
                  </span>
                </th>
                <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium min-w-[100px]">Wix</th>
                <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium min-w-[120px]">Squarespace</th>
                <th className="px-6 py-4 text-center text-[--color-text-muted] font-medium min-w-[120px]">
                  {t('freelancerCol')}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPETITOR_TABLE.map((row, i) => {
                const featureKey = row.feature.replace('competitor.', '') as Parameters<typeof t>[0];
                return (
                  <tr
                    key={i}
                    className={`border-b border-[--color-border] last:border-0 transition-colors hover:bg-[--color-card-hover] ${
                      i % 2 === 0 ? 'bg-[--color-bg]' : 'bg-[--color-card]'
                    }`}
                  >
                    <td className="px-6 py-4 text-[--color-text-muted]">{t(featureKey)}</td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.vendshop} highlight />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.wix} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.squarespace} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.freelancer} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
