import { getStoreBySlug, getStoreByDomain } from '@/lib/shop-queries';
import { getShopTranslations } from '@/lib/shop-i18n';
import { COLOR_SCHEMES } from '@/lib/constants';
import CheckoutForm from '@/components/shop/CheckoutForm';

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug).then(s => s || getStoreByDomain(slug));

  if (!store || !store.isPublished) {
    return null;
  }

  const [scheme, t] = await Promise.all([
    Promise.resolve(COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light),
    getShopTranslations(store.shopLanguage),
  ]);

  return <CheckoutForm slug={slug} scheme={scheme} t={t} />;
}
