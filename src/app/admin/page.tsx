import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAllStoresAdmin } from '@/lib/shop-queries';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect('/');
  }

  const stores = await getAllStoresAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Admin — Obchody</h1>
          <p className="mt-1 text-sm text-neutral">{stores.length} obchodov celkovo</p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-secondary hover:bg-gray-50"
        >
          Používatelia →
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-secondary">Slug</th>
              <th className="px-4 py-3 font-semibold text-secondary">Názov</th>
              <th className="px-4 py-3 font-semibold text-secondary">Vlastník</th>
              <th className="px-4 py-3 font-semibold text-secondary">Typ</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">Produkty</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">Stav</th>
              <th className="px-4 py-3 font-semibold text-secondary">Vytvorený</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/shop/${store.slug}`} className="font-medium text-primary hover:underline">
                    {store.slug}
                  </Link>
                </td>
                <td className="px-4 py-3 text-secondary">{store.name}</td>
                <td className="px-4 py-3 text-neutral">{store.userEmail}</td>
                <td className="px-4 py-3 text-neutral">{store.templateId}</td>
                <td className="px-4 py-3 text-center text-secondary">{store.itemCount}</td>
                <td className="px-4 py-3 text-center">
                  {store.isPublished ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Živý
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Draft
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
            Žiadne obchody.
          </div>
        )}
      </div>
    </div>
  );
}
