import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { getStoreCategories } from '@/lib/shop-queries';
import ProductForm from '@/components/dashboard/ProductForm';
import type { ProductFormData, ItemType } from '@/lib/types';

export async function generateMetadata() {
  const t = await getTranslations('dashboardProducts');
  return { title: `${t('editProduct')} | Dashboard` };
}

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;

  const item = await db.item.findFirst({
    where: { id, store: { userId: session.user.id } },
    include: { store: { select: { id: true, shopLanguage: true } } },
  });

  if (!item) notFound();

  const [categories, t] = await Promise.all([
    getStoreCategories(item.store.id),
    getTranslations('dashboardProducts'),
  ]);

  const defaultValues: Partial<ProductFormData> = {
    name: item.name,
    description: item.description || '',
    price: item.price?.toString() || '',
    currency: item.currency,
    category: item.category || '',
    type: item.type as ItemType,
    isAvailable: item.isAvailable,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">{t('editProduct')}</h1>
        <p className="mt-1 text-sm text-neutral">{t('editProductDesc')}</p>
      </div>
      <ProductForm storeId={item.store.id} shopLanguage={item.store.shopLanguage} itemId={item.id} defaultValues={defaultValues} existingCategories={categories} />
    </div>
  );
}
