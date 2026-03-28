import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getStoreBySlug, getStoreByDomain, getStoreItems, getStoreCategories, getStoreReviews, getStoreAverageRating } from '@/lib/shop-queries';
import { COLOR_SCHEMES } from '@/lib/constants';
import { getShopTranslations, pluralizeItems } from '@/lib/shop-i18n';
import ProductGrid from '@/components/shop/ProductGrid';
import CategoryFilter from '@/components/shop/CategoryFilter';
import QuickBadgesStrip from '@/components/shop/QuickBadgesStrip';
import StoreStatus from '@/components/shop/StoreStatus';
import ReviewsSection from '@/components/shop/ReviewsSection';
import SearchBar from '@/components/shop/SearchBar';
import CookieConsent from '@/components/shop/CookieConsent';

interface ShopPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { slug } = await params;
  const { category, q } = await searchParams;

  // Try slug first, then custom domain (middleware passes custom domains as slug)
  const store = await getStoreBySlug(slug) || await getStoreByDomain(slug);

  if (!store || !store.isPublished) {
    notFound();
  }

  const [items, categories, t, reviews, ratingData] = await Promise.all([
    getStoreItems(store.id, category, q),
    getStoreCategories(store.id),
    getShopTranslations(store.shopLanguage),
    getStoreReviews(store.id),
    getStoreAverageRating(store.id),
  ]);

  const scheme = COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light;
  const s = store.settings;

  return (
    <>
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className={`relative overflow-hidden ${s.bannerImage ? '' : scheme.heroBg} border-b ${scheme.border}`}>
        {/* Banner background image */}
        {s.bannerImage && (
          <>
            <Image
              src={s.bannerImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">

            {/* Logo avatar */}
            {store.logo ? (
              <Image
                src={store.logo}
                alt={store.name}
                width={80}
                height={80}
                className="mb-5 rounded-2xl object-cover shadow-md"
                priority
              />
            ) : (
              <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold shadow-md ${scheme.accent}`}>
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name */}
            <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl ${s.bannerImage ? 'text-white' : ''}`}>
              {store.name}
            </h1>

            {/* Description */}
            {store.description && (
              <p className={`mt-4 max-w-2xl text-lg leading-relaxed ${s.bannerImage ? 'text-white/80' : scheme.textMuted}`}>
                {store.description}
              </p>
            )}

            {/* Info chips row */}
            {(s.address || s.openingHours || s.deliveryInfo || s.phone) && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {s.address && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${s.bannerImage ? 'bg-white/20 text-white backdrop-blur-sm' : `${scheme.chipBg} ${scheme.chipText}`}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {s.address}
                  </span>
                )}
                {s.openingHours && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${s.bannerImage ? 'bg-white/20 text-white backdrop-blur-sm' : `${scheme.chipBg} ${scheme.chipText}`}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {s.openingHours}
                  </span>
                )}
                {s.deliveryInfo && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${s.bannerImage ? 'bg-white/20 text-white backdrop-blur-sm' : `${scheme.chipBg} ${scheme.chipText}`}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" />
                      <path d="M16 8h4l3 3v5h-7V8z" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    {s.deliveryInfo}
                  </span>
                )}
              </div>
            )}

            {/* Open / Closed status + order acceptance */}
            {s.structuredHours && (
              <div className="mt-4">
                <StoreStatus
                  hours={s.structuredHours}
                  orderAcceptance={s.orderAcceptance}
                  scheme={scheme}
                  shopLanguage={store.shopLanguage}
                  hasBanner={!!s.bannerImage}
                />
              </div>
            )}

            {/* CTA buttons */}
            {(s.phone || s.whatsapp) && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${scheme.accent} ${scheme.accentHover}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {s.phone}
                  </a>
                )}
                {s.whatsapp && (
                  <a
                    href={`https://wa.me/${s.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── QUICK BADGES ──────────────────────────────────────────────────── */}
      {s.quickBadges && s.quickBadges.length > 0 && (
        <QuickBadgesStrip badgeIds={s.quickBadges} scheme={scheme} shopLanguage={store.shopLanguage} />
      )}

      {/* ── CATALOG ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Section header + search */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">
              {q ? `"${q}"` : category ? category : t.catalog}
            </h2>
            <span className={`text-sm ${scheme.textMuted}`}>
              {pluralizeItems(items.length, t)}
            </span>
          </div>
          <div className="w-full sm:w-72">
            <SearchBar scheme={scheme} t={t} />
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 1 && !q && (
          <CategoryFilter
            categories={categories}
            activeCategory={category || null}
            slug={slug}
            scheme={scheme}
            t={t}
          />
        )}

        {/* Products */}
        {items.length > 0 ? (
          <ProductGrid items={items} scheme={scheme} currency={store.settings.currency || 'EUR'} t={t} />
        ) : q ? (
          <div className="py-20 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${scheme.bgCard}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className={`text-lg font-medium ${scheme.textMuted}`}>
              {t.searchNoResults}
            </p>
            <p className={`mt-1 text-sm ${scheme.textMuted} opacity-70`}>
              {t.searchNoResultsDesc}
            </p>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${scheme.bgCard}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
            </div>
            <p className={`text-lg font-medium ${scheme.textMuted}`}>
              {category ? t.emptyCategory : t.emptyStore}
            </p>
          </div>
        )}
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────────── */}
      <ReviewsSection
        reviews={reviews}
        avgRating={ratingData.avg}
        reviewCount={ratingData.count}
        storeId={store.id}
        scheme={scheme}
        t={t}
      />

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      {s.aboutText && (
        <section className={`border-t ${scheme.border}`}>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2 className="mb-4 text-2xl font-bold">{t.aboutUs}</h2>
              <p className={`leading-relaxed ${scheme.textMuted}`}>{s.aboutText}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ─────────────────────────────────────────────────────── */}
      {(s.phone || s.address || s.openingHours || s.instagram || s.facebook || s.whatsapp) && (
        <section className={`border-t ${scheme.border} ${scheme.bgCard}`}>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-2xl font-bold">{t.contact}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

              {/* Phone */}
              {s.phone && (
                <a href={`tel:${s.phone}`} className={`flex items-start gap-4 rounded-xl border ${scheme.border} bg-white bg-opacity-60 p-5 transition-shadow hover:shadow-md`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${scheme.accent}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${scheme.textMuted}`}>{t.phone}</p>
                    <p className="mt-0.5 font-semibold">{s.phone}</p>
                  </div>
                </a>
              )}

              {/* Address */}
              {s.address && (
                <div className={`flex items-start gap-4 rounded-xl border ${scheme.border} bg-white bg-opacity-60 p-5`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${scheme.accent}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${scheme.textMuted}`}>{t.address}</p>
                    <p className="mt-0.5 font-semibold">{s.address}</p>
                    {s.openingHours && <p className={`mt-1 text-sm ${scheme.textMuted}`}>{s.openingHours}</p>}
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {s.whatsapp && (
                <a
                  href={`https://wa.me/${s.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-4 rounded-xl border ${scheme.border} bg-white bg-opacity-60 p-5 transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${scheme.textMuted}`}>WhatsApp</p>
                    <p className="mt-0.5 font-semibold">{t.writeUs}</p>
                  </div>
                </a>
              )}

              {/* Instagram */}
              {s.instagram && (
                <a
                  href={`https://instagram.com/${s.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-4 rounded-xl border ${scheme.border} bg-white bg-opacity-60 p-5 transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${scheme.textMuted}`}>Instagram</p>
                    <p className="mt-0.5 font-semibold">@{s.instagram}</p>
                  </div>
                </a>
              )}

              {/* Facebook */}
              {s.facebook && (
                <a
                  href={`https://facebook.com/${s.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-4 rounded-xl border ${scheme.border} bg-white bg-opacity-60 p-5 transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${scheme.textMuted}`}>Facebook</p>
                    <p className="mt-0.5 font-semibold">{s.facebook}</p>
                  </div>
                </a>
              )}

            </div>

            {/* ── Map embed ──────────────────────────────────────────── */}
            {s.coordinates && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200">
                <iframe
                  title="Store location"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${s.coordinates.lng - 0.008},${s.coordinates.lat - 0.005},${s.coordinates.lng + 0.008},${s.coordinates.lat + 0.005}&layer=mapnik&marker=${s.coordinates.lat},${s.coordinates.lng}`}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Cookie Consent */}
      <CookieConsent
        text={t.cookieText}
        acceptLabel={t.cookieAccept}
        declineLabel={t.cookieDecline}
      />
    </>
  );
}
