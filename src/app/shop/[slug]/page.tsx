import { notFound } from 'next/navigation';
import { getStoreBySlug, getStoreItems, getStoreCategories } from '@/lib/shop-queries';
import { COLOR_SCHEMES } from '@/lib/constants';
import ProductGrid from '@/components/shop/ProductGrid';
import CategoryFilter from '@/components/shop/CategoryFilter';

interface ShopPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { slug } = await params;
  const { category } = await searchParams;
  const store = await getStoreBySlug(slug);

  if (!store || !store.isPublished) {
    notFound();
  }

  const [items, categories] = await Promise.all([
    getStoreItems(store.id, category),
    getStoreCategories(store.id),
  ]);

  const scheme = COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero banner */}
      {store.description && (
        <section className="mb-8 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{store.name}</h1>
          <p className={`mt-3 text-lg ${scheme.textMuted}`}>{store.description}</p>
        </section>
      )}

      {/* Delivery / about info */}
      {store.settings.deliveryInfo && (
        <div className={`mb-6 rounded-lg ${scheme.bgCard} ${scheme.border} border p-4 text-center text-sm ${scheme.textMuted}`}>
          {store.settings.deliveryInfo}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <CategoryFilter
          categories={categories}
          activeCategory={category || null}
          slug={slug}
          scheme={scheme}
        />
      )}

      {/* Products */}
      {items.length > 0 ? (
        <ProductGrid items={items} scheme={scheme} currency={store.settings.currency || 'EUR'} />
      ) : (
        <div className="py-20 text-center">
          <p className={`text-lg ${scheme.textMuted}`}>
            {category
              ? 'V tejto kategórii zatiaľ nie sú žiadne produkty.'
              : 'Obchod zatiaľ nemá žiadne produkty.'}
          </p>
        </div>
      )}
    </div>
  );
}
