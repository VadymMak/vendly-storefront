import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/shop-queries';
import { COLOR_SCHEMES } from '@/lib/constants';
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
  const store = await getStoreBySlug(slug);

  if (!store) return { title: 'Obchod nenájdený' };

  return {
    title: `${store.name} | VendShop`,
    description: store.description || `${store.name} — online obchod na VendShop`,
  };
}

export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);

  if (!store || !store.isPublished) {
    notFound();
  }

  const scheme = COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light;

  return (
    <CartProvider currency={store.settings.currency || 'EUR'}>
      <div className={`min-h-screen flex flex-col ${scheme.bg} ${scheme.text}`}>
        <ShopHeader store={store} scheme={scheme} />
        <main className="flex-1">
          {children}
        </main>
        <ShopFooter store={store} scheme={scheme} />
        <CartDrawer scheme={scheme} />
      </div>
    </CartProvider>
  );
}
