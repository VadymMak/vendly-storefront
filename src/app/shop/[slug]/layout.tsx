import { notFound } from 'next/navigation';
import { getStoreBySlug, getStoreByDomain, getStoreCategories } from '@/lib/shop-queries';
import { COLOR_SCHEMES } from '@/lib/constants';
import { getShopTranslations } from '@/lib/shop-i18n';
import ShopHeader from '@/components/shop/ShopHeader';
import ShopFooter from '@/components/shop/ShopFooter';
import { CartProvider } from '@/components/shop/CartContext';
import CartDrawer from '@/components/shop/CartDrawer';

interface ShopLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug) || await getStoreByDomain(slug);

  if (!store) return { title: 'Store not found' };

  const t = await getShopTranslations(store.shopLanguage);

  return {
    title: `${store.name} | VendShop`,
    description: store.description || `${store.name} — ${t.onlineStore}`,
  };
}

export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug) || await getStoreByDomain(slug);

  if (!store || !store.isPublished) {
    notFound();
  }

  const scheme = COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light;
  const [t, categories] = await Promise.all([
    getShopTranslations(store.shopLanguage),
    getStoreCategories(store.id),
  ]);

  return (
    <CartProvider currency={store.settings.currency || 'EUR'}>
      <div className={`min-h-screen flex flex-col ${scheme.bg} ${scheme.text}`}>
        <ShopHeader store={store} scheme={scheme} t={t} categories={categories} />
        <main className="flex-1">
          {children}
        </main>
        <ShopFooter store={store} scheme={scheme} t={t} />
        <CartDrawer scheme={scheme} t={t} />
      </div>
    </CartProvider>
  );
}
