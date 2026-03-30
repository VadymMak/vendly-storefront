import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getStoreByUserId, getStoreCategories } from '@/lib/shop-queries';
import ProductForm from '@/components/dashboard/ProductForm';

export async function generateMetadata() {
  const t = await getTranslations('dashboardProducts');
  return { title: `${t('newProduct')} | Dashboard` };
}

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const store = await getStoreByUserId(session.user.id);
  if (!store) redirect('/dashboard');

  const [categories, t] = await Promise.all([
    getStoreCategories(store.id),
    getTranslations('dashboardProducts'),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">{t('newProduct')}</h1>
        <p className="mt-1 text-sm text-neutral">{t('newProductDesc')}</p>
      </div>
      <ProductForm storeId={store.id} shopLanguage={store.shopLanguage} existingCategories={categories} />
    </div>
  );
}
