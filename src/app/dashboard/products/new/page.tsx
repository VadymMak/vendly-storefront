import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getStoreByUserId } from '@/lib/shop-queries';
import ProductForm from '@/components/dashboard/ProductForm';

export const metadata = { title: 'Nový produkt | Dashboard' };

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const store = await getStoreByUserId(session.user.id);
  if (!store) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Nový produkt</h1>
        <p className="mt-1 text-sm text-neutral">Pridajte produkt, službu alebo položku menu.</p>
      </div>
      <ProductForm storeId={store.id} />
    </div>
  );
}
