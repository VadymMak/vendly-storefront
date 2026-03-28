import { notFound } from 'next/navigation';
import { getStoreBySlug, getStoreByDomain, getStoreItem } from '@/lib/shop-queries';
import { getShopTranslations } from '@/lib/shop-i18n';
import { COLOR_SCHEMES, CURRENCY_SYMBOLS } from '@/lib/constants';
import ItemImageGallery from '@/components/shop/ItemImageGallery';
import AddToCartButton from '@/components/shop/AddToCartButton';
import Link from 'next/link';

interface ItemPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: ItemPageProps) {
  const { id } = await params;
  const item = await getStoreItem(id);

  if (!item) {
    const t = await getShopTranslations('sk');
    return { title: t.productNotFound };
  }

  return {
    title: item.name,
    description: item.description || item.name,
  };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { slug, id } = await params;
  const [store, item] = await Promise.all([
    getStoreBySlug(slug).then(s => s || getStoreByDomain(slug)),
    getStoreItem(id),
  ]);

  if (!store || !store.isPublished || !item) {
    notFound();
  }

  const [scheme, currencySymbol, t] = await Promise.all([
    Promise.resolve(COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light),
    Promise.resolve(CURRENCY_SYMBOLS[item.currency] || item.currency),
    getShopTranslations(store.shopLanguage),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className={`mb-6 text-sm ${scheme.textMuted}`}>
        <Link href={`/`} className="hover:underline">
          {store.name}
        </Link>
        <span className="mx-2">/</span>
        {item.category && (
          <>
            <Link
              href={`/?category=${encodeURIComponent(item.category)}`}
              className="hover:underline"
            >
              {item.category}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span>{item.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Images */}
        <ItemImageGallery images={item.images} name={item.name} scheme={scheme} />

        {/* Details */}
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{item.name}</h1>

          {item.category && (
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${scheme.bgCard} ${scheme.textMuted}`}>
              {item.category}
            </span>
          )}

          {item.price !== null && (
            <p className="mt-4 text-3xl font-bold">
              {item.price.toFixed(2)} {currencySymbol}
            </p>
          )}

          {item.description && (
            <div className={`mt-6 leading-relaxed ${scheme.textMuted}`}>
              {item.description.split('\n').map((paragraph, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : ''}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {!item.isAvailable && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {t.productUnavailable}
            </div>
          )}

          {item.isAvailable && item.price !== null && (
            <div className="mt-8">
              <AddToCartButton item={item} scheme={scheme} t={t} />
            </div>
          )}

          {/* WhatsApp contact */}
          {store.settings.whatsapp && (
            <a
              href={`https://wa.me/${store.settings.whatsapp}?text=${encodeURIComponent(`${t.whatsappMessage} ${item.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 flex items-center justify-center gap-2 rounded-lg border ${scheme.border} px-6 py-3 font-medium transition-colors hover:bg-green-50`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t.writeViaWhatsApp}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
