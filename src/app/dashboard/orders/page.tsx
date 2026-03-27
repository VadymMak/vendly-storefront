import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getStoreByUserId, getDashboardOrders } from '@/lib/shop-queries';
import OrderStatusBadge from '@/components/dashboard/OrderStatusBadge';

export const metadata = { title: 'Objednávky | Dashboard' };

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const store = await getStoreByUserId(session.user.id);
  if (!store) redirect('/dashboard');

  const orders = await getDashboardOrders(store.id, 50);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Objednávky</h1>
        <p className="mt-1 text-sm text-neutral">{orders.length} objednávok celkom</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <p className="mt-3 font-medium text-secondary">Zatiaľ žiadne objednávky</p>
          <p className="mt-1 text-sm text-neutral">Objednávky sa objavia tu keď zákazníci nakúpia.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-neutral">Zákazník</th>
                <th className="hidden px-4 py-3 font-medium text-neutral sm:table-cell">E-mail</th>
                <th className="px-4 py-3 font-medium text-neutral">Suma</th>
                <th className="px-4 py-3 font-medium text-neutral">Stav</th>
                <th className="hidden px-4 py-3 font-medium text-neutral md:table-cell">Dátum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-secondary">{order.customerName}</td>
                  <td className="hidden px-4 py-3 text-neutral sm:table-cell">{order.customerEmail}</td>
                  <td className="px-4 py-3 font-semibold">{order.total.toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge orderId={order.id} status={order.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-neutral md:table-cell">
                    {new Date(order.createdAt).toLocaleDateString('sk-SK')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
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
