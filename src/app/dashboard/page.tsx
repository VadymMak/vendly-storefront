import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId, getDashboardStats, getDashboardOrders } from '@/lib/shop-queries';
import { getStoreUrl } from '@/lib/constants';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('dashboardOverview');

  const store = await getStoreByUserId(session.user.id);

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-secondary">{t('noStore')}</h2>
        <p className="mt-2 text-neutral">{t('noStoreDesc')}</p>
        <Link href="/dashboard/settings" className="mt-6 rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark">
          {t('createStore')}
        </Link>
      </div>
    );
  }

  const [stats, recentOrders] = await Promise.all([
    getDashboardStats(store.id),
    getDashboardOrders(store.id, 5),
  ]);

  const STATUS_LABELS: Record<string, { label: string; class: string }> = {
    PENDING:   { label: t('statusPending'),   class: 'bg-yellow-100 text-yellow-800' },
    PAID:      { label: t('statusPaid'),      class: 'bg-green-100 text-green-800' },
    SHIPPED:   { label: t('statusShipped'),   class: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: t('statusCompleted'), class: 'bg-gray-100 text-gray-800' },
    CANCELLED: { label: t('statusCancelled'), class: 'bg-red-100 text-red-800' },
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">{store.name}</h1>
          <p className="mt-1 text-sm text-neutral">
            {store.isPublished ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {t('storePublished')} —{' '}
                <a href={`https://${store.slug}.vendshop.shop`} target="_blank" rel="noopener noreferrer" className="underline">
                  {store.slug}.vendshop.shop
                </a>
              </span>
            ) : (
              <span className="text-amber-600">{t('storeNotPublished')}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={getStoreUrl(store.slug)} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t('viewStore')}
          </a>
          <Link href="/dashboard/products/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            {t('addProduct')}
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('statsProducts')} value={stats.itemCount}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>}
          href="/dashboard/products" />
        <StatCard label={t('statsOrders')} value={stats.orderCount}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
          href="/dashboard/orders" />
        <StatCard label={t('statsRevenue')} value={`${stats.revenue.toFixed(2)} €`}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-secondary">{t('recentOrders')}</h2>
          <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">{t('allOrders')}</Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-10 text-center text-neutral">{t('noOrders')}</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentOrders.map((order) => {
              const status = STATUS_LABELS[order.status] || { label: order.status, class: 'bg-gray-100 text-gray-600' };
              return (
                <li key={order.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-secondary">{order.customerName}</p>
                    <p className="text-sm text-neutral">{order.customerEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.class}`}>{status.label}</span>
                    <span className="font-semibold text-secondary">{order.total.toFixed(2)} €</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, href }: { label: string; value: string | number; icon: React.ReactNode; href?: string }) {
  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">{icon}</div>
      <div>
        <p className="text-sm text-neutral">{label}</p>
        <p className="text-2xl font-bold text-secondary">{value}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block hover:shadow-md transition-shadow">{content}</Link>;
  return content;
}
