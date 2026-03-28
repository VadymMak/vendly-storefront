import Link from 'next/link';
import { getPublishedStores } from '@/lib/shop-queries';
import { BUSINESS_TYPES, getStoreUrl } from '@/lib/constants';
import type { BrowseStore } from '@/lib/types';

const TEMPLATE_MAP = Object.fromEntries(
  BUSINESS_TYPES.map((t) => [t.id, { icon: t.icon, label: t.title }]),
);

interface BrowsePageProps {
  searchParams: Promise<{ type?: string }>;
}

function StoreIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="text-primary">
      <path d="M5 12v14a2 2 0 002 2h18a2 2 0 002-2V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 6h28l-2.5 6H4.5L2 6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StoreCard({ store }: { store: BrowseStore }) {
  const template = TEMPLATE_MAP[store.templateId];

  return (
    <a
      href={getStoreUrl(store.slug)}
      className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-6"
    >
      {/* Logo / fallback */}
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent">
        {store.logo ? (
          <img
            src={store.logo}
            alt={store.name}
            className="h-10 w-10 rounded-lg object-cover"
          />
        ) : (
          <StoreIcon />
        )}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-secondary group-hover:text-primary">
        {store.name}
      </h3>

      {store.description && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral">
          {store.description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-4">
        {/* Template badge */}
        {template && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
            <span>{template.icon}</span>
            <span>{template.label}</span>
          </span>
        )}

        {/* Item count */}
        <span className="text-xs text-neutral">
          {store.itemCount} {store.itemCount === 1 ? 'produkt' : 'produktov'}
        </span>
      </div>
    </a>
  );
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { type } = await searchParams;
  const stores = await getPublishedStores(type);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-secondary sm:text-3xl">
          Obchody na VendShop
        </h1>
        <p className="mt-2 text-neutral">
          Prezrite si obchody vytvorené na našej platforme.
        </p>
      </div>

      {/* Filter by type */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link
          href="/browse"
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !type
              ? 'bg-primary text-white'
              : 'border border-gray-200 bg-white text-secondary hover:border-primary/30 hover:bg-accent'
          }`}
        >
          Všetky
        </Link>
        {BUSINESS_TYPES.map((t) => (
          <Link
            key={t.id}
            href={`/browse?type=${t.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              type === t.id
                ? 'bg-primary text-white'
                : 'border border-gray-200 bg-white text-secondary hover:border-primary/30 hover:bg-accent'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.title}</span>
          </Link>
        ))}
      </div>

      {/* Store grid */}
      {stores.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg text-neutral">
            {type
              ? 'V tejto kategórii zatiaľ nie sú žiadne obchody.'
              : 'Zatiaľ nie sú žiadne obchody.'}
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark"
          >
            Vytvoriť prvý obchod
          </Link>
        </div>
      )}
    </div>
  );
}
