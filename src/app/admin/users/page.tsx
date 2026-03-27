import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAllUsersAdmin } from '@/lib/shop-queries';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const PLAN_STYLES: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  STARTER: 'bg-blue-100 text-blue-800',
  PRO: 'bg-purple-100 text-purple-800',
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect('/');
  }

  const users = await getAllUsersAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Admin — Používatelia</h1>
          <p className="mt-1 text-sm text-neutral">{users.length} používateľov celkovo</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-secondary hover:bg-gray-50"
        >
          ← Obchody
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-secondary">Email</th>
              <th className="px-4 py-3 font-semibold text-secondary">Meno</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">Plán</th>
              <th className="px-4 py-3 font-semibold text-secondary text-center">Obchody</th>
              <th className="px-4 py-3 font-semibold text-secondary">Registrácia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-secondary">{user.email}</td>
                <td className="px-4 py-3 text-neutral">{user.name || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_STYLES[user.plan] || 'bg-gray-100 text-gray-700'}`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-secondary">{user.storeCount}</td>
                <td className="px-4 py-3 text-neutral">
                  {new Date(user.createdAt).toLocaleDateString('sk')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="py-12 text-center text-neutral">
            Žiadni používatelia.
          </div>
        )}
      </div>
    </div>
  );
}
