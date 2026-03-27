import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId, getStoreItems } from '@/lib/shop-queries';
import DeleteItemButton from '@/components/dashboard/DeleteItemButton';

export const metadata = { title: 'Products | Dashboard' };

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const t = await getTranslations('dashboardProducts');

  const store = await getStoreByUserId(session.user.id);
  if (!store) redirect('/dashboard');

  const items = await getStoreItems(store.id);

  const TYPE_LABELS: Record<string, string> = {
    PRODUCT:   t('typeProduct'),
    SERVICE:   t('typeService'),
    MENU_ITEM: t('typeMenu'),
    PORTFOLIO: t('typePortfolio'),
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary">{t('title')}</h1>
        <Link href="/dashboard/products/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          {t('addProduct')}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <p className="mt-3 font-medium text-secondary">{t('noProducts')}</p>
          <p className="mt-1 text-sm text-neutral">{t('noProductsDesc')}</p>
          <Link href="/dashboard/products/new"
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            {t('addProduct')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-neutral">{t('colProduct')}</th>
                <th className="hidden px-4 py-3 font-medium text-neutral sm:table-cell">{t('colType')}</th>
                <th className="hidden px-4 py-3 font-medium text-neutral sm:table-cell">{t('colCategory')}</th>
                <th className="px-4 py-3 font-medium text-neutral">{t('colPrice')}</th>
                <th className="px-4 py-3 font-medium text-neutral">{t('colAvailable')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.images[0] ? (
                        <img src={item.images[0]} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        </div>
                      )}
                      <span className="font-medium text-secondary">{item.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-neutral sm:table-cell">{TYPE_LABELS[item.type] || item.type}</td>
                  <td className="hidden px-4 py-3 text-neutral sm:table-cell">{item.category || t('noCategory')}</td>
                  <td className="px-4 py-3 font-medium">{item.price !== null ? `${item.price.toFixed(2)} €` : t('noPrice')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.isAvailable ? t('available') : t('unavailable')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/products/${item.id}/edit`}
                        className="rounded px-2 py-1 text-xs text-primary hover:bg-accent">
                        {t('edit')}
                      </Link>
                      <DeleteItemButton itemId={item.id} itemName={item.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
