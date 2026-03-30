import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getStoreBySlug, getStoreByDomain, getStoreItems, getStoreCategories, getStoreReviews, getStoreAverageRating } from '@/lib/shop-queries';
import { COLOR_SCHEMES } from '@/lib/constants';
import { getShopTranslations, pluralizeItems } from '@/lib/shop-i18n';
import ProductGrid from '@/components/shop/ProductGrid';
import CategoryFilter from '@/components/shop/CategoryFilter';
import QuickBadgesStrip from '@/components/shop/QuickBadgesStrip';
import ReviewsSection from '@/components/shop/ReviewsSection';
import SearchBar from '@/components/shop/SearchBar';
import ShopNewsletter from '@/components/shop/ShopNewsletter';
import ShopHero from '@/components/shop/ShopHero';
import CookieConsent from '@/components/shop/CookieConsent';
import ShopMap from '@/components/shop/ShopMap';

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

  const [items, allItems, categories, t, reviews, ratingData] = await Promise.all([
    getStoreItems(store.id, category, q),
    // Unfiltered items for hero showcase (needs all categories)
    (category || q) ? getStoreItems(store.id) : Promise.resolve(null),
    getStoreCategories(store.id),
    getShopTranslations(store.shopLanguage),
    getStoreReviews(store.id),
    getStoreAverageRating(store.id),
  ]);
  // Hero always gets full item list; catalog gets filtered list
  const heroItems = allItems ?? items;

  const scheme = COLOR_SCHEMES[store.settings.colorScheme] || COLOR_SCHEMES.light;
  const s = store.settings;

  // Custom color overrides via CSS custom properties
  const shopCssVars: Record<string, string> = {};
  if (s.customFontColor)  shopCssVars['--shop-font'] = s.customFontColor;
  if (s.customAccentColor) shopCssVars['--shop-accent'] = s.customAccentColor;
  const hasCustomVars = Object.keys(shopCssVars).length > 0;

  return (
    <div style={hasCustomVars ? (shopCssVars as React.CSSProperties) : undefined}>
      {/* ── HERO ────────────────────────────────────────────────────── */}
      <ShopHero store={store} scheme={scheme} t={t} items={heroItems} categories={categories} />

      {/* ── QUICK BADGES ──────────────────────────────────────────────────── */}
      {s.quickBadges && s.quickBadges.length > 0 && (
        <QuickBadgesStrip badgeIds={s.quickBadges} scheme={scheme} shopLanguage={store.shopLanguage} />
      )}

      {/* ── CATALOG ─────────────────────────────────────────────────────── */}
      <section id="products" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 scroll-mt-28">
        {/* Section header + search */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={`text-[32px] font-extrabold tracking-tight ${scheme.headingFont || ''}`} style={{ letterSpacing: '-0.02em' }}>
              {q ? `"${q}"` : category ? category : t.catalog}
            </h2>
            <p className={`mt-1 text-sm ${scheme.textMuted}`}>
              {pluralizeItems(items.length, t)}
            </p>
          </div>
          <div className="w-full sm:w-80">
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
          <ProductGrid items={items} scheme={scheme} currency={store.settings.currency || 'EUR'} t={t} promoBanners={s.promoBanners} />
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
      <div id="reviews" className="scroll-mt-20" />
      <ReviewsSection
        reviews={reviews}
        avgRating={ratingData.avg}
        reviewCount={ratingData.count}
        storeId={store.id}
        scheme={scheme}
        t={t}
      />

      {/* ── ABOUT — avatar + text + stats ─────────────────────────── */}
      {s.aboutText && (
        <section id="about" className={`border-y ${scheme.border} bg-white scroll-mt-20`}>
          <div className="mx-auto max-w-7xl px-6 py-[72px] sm:px-10 lg:px-12">
            <div className="grid items-center gap-10 sm:grid-cols-[auto_1fr] sm:gap-14">
              {/* Avatar — gradient or image, 180px */}
              <div className="mx-auto sm:mx-0">
                {store.logo ? (
                  <Image
                    src={store.logo}
                    alt={store.name}
                    width={180}
                    height={180}
                    className="h-[160px] w-[160px] rounded-3xl object-cover shadow-[0_8px_32px_color-mix(in_srgb,var(--color-warm-accent)_25%,transparent)] sm:h-[180px] sm:w-[180px]"
                  />
                ) : (
                  <div
                    className="flex h-[160px] w-[160px] items-center justify-center rounded-3xl text-[64px] font-extrabold text-white shadow-[0_8px_32px_color-mix(in_srgb,var(--color-warm-accent)_25%,transparent)] sm:h-[180px] sm:w-[180px]"
                    style={{ background: 'linear-gradient(135deg, var(--color-warm-accent), var(--color-warm-accent-glow))' }}
                  >
                    {store.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-warm-accent">
                  {t.aboutUs}
                </p>
                <h2 className={`mt-2 text-[28px] font-extrabold tracking-tight ${scheme.headingFont || ''}`} style={{ letterSpacing: '-0.02em' }}>
                  {store.name}
                </h2>
                <p className="mt-3 max-w-[560px] text-[15px] leading-[1.7] text-warm-muted">
                  {s.aboutText}
                </p>

                {/* Stats row */}
                <div className="mt-6 flex flex-wrap justify-center gap-8 sm:justify-start">
                  <div>
                    <p className="text-[28px] font-extrabold text-warm-text" style={{ letterSpacing: '-0.02em' }}>{items.length}+</p>
                    <p className="text-xs font-medium text-warm-muted">{t.navProducts}</p>
                  </div>
                  {categories.length > 1 && (
                    <div>
                      <p className="text-[28px] font-extrabold text-warm-text" style={{ letterSpacing: '-0.02em' }}>{categories.length}</p>
                      <p className="text-xs font-medium text-warm-muted">{t.allCategories}</p>
                    </div>
                  )}
                  {ratingData.count > 0 && (
                    <div>
                      <p className="text-[28px] font-extrabold text-warm-text" style={{ letterSpacing: '-0.02em' }}>{ratingData.avg.toFixed(1)}</p>
                      <p className="text-xs font-medium text-warm-muted">{ratingData.count} {t.reviewsCount}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── NEWSLETTER ────────────────────────────────────────────────── */}
      <ShopNewsletter storeId={store.id} scheme={scheme} t={t} />

      {/* ── CONTACT ─────────────────────────────────────────────────────── */}
      {(s.phone || s.address || s.openingHours || s.instagram || s.facebook || s.whatsapp) && (
        <section id="contact" className={`border-t ${scheme.border} scroll-mt-20`}>
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className={`mb-8 text-2xl font-extrabold tracking-tight sm:text-3xl ${scheme.headingFont || ''}`}>{t.contact}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              {/* Phone */}
              {s.phone && (
                <a href={`tel:${s.phone}`} className={`flex items-start gap-4 rounded-2xl border ${scheme.border} bg-white/70 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${scheme.accent}`}>
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
                <div className={`flex items-start gap-4 rounded-2xl border ${scheme.border} bg-white/70 p-5 shadow-sm`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${scheme.accent}`}>
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
                  className={`flex items-start gap-4 rounded-2xl border ${scheme.border} bg-white/70 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
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
                  className={`flex items-start gap-4 rounded-2xl border ${scheme.border} bg-white/70 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
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
                  className={`flex items-start gap-4 rounded-2xl border ${scheme.border} bg-white/70 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
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

            {/* ── Map ──────────────────────────────────────────── */}
            {s.coordinates && (
              <div className="mt-8">
                <ShopMap
                  lat={s.coordinates.lat}
                  lng={s.coordinates.lng}
                  storeName={store.name}
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
    </div>
  );
}
