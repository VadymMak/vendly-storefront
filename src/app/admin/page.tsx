import { getAllStoresAdmin } from '@/lib/shop-queries';
import { getStoreUrl } from '@/lib/constants';
import { getTranslations } from 'next-intl/server';

export default async function AdminPage() {
  const stores = await getAllStoresAdmin();
  const t = await getTranslations('admin');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary">{t('stores')}</h1>
        <p className="mt-1 text-sm text-neutral">{stores.length} {t('total')}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-secondary">{t('slug')}</th>
              <th className="px-4 py-3 font-semibold text-secondary">{t('name')}</th>
              <th className="px-4 py-3 font-semibold text-secondary">{t('owner')}</th>
              <th className="px-4 py-3 font-semibold text-secondary">{t('type')}</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">{t('products')}</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">{t('status')}</th>
              <th className="px-4 py-3 font-semibold text-secondary">{t('created')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={getStoreUrl(store.slug)} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                    {store.slug}
                  </a>
                </td>
                <td className="px-4 py-3 text-secondary">{store.name}</td>
                <td className="px-4 py-3 text-neutral">{store.userEmail}</td>
                <td className="px-4 py-3 text-neutral">{store.templateId}</td>
                <td className="px-4 py-3 text-center text-secondary">{store.itemCount}</td>
                <td className="px-4 py-3 text-center">
                  {store.isPublished ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {t('live')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {t('draft')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral">
                  {new Date(store.createdAt).toLocaleDateString('sk')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {stores.length === 0 && (
          <div className="py-12 text-center text-neutral">
            {t('noStores')}
          </div>
        )}
      </div>
    </div>
  );
}
