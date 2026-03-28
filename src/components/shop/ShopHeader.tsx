'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import CartButton from './CartButton';

interface ShopHeaderProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function ShopHeader({ store, scheme, t }: ShopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-50 ${scheme.headerBg} ${scheme.border} border-b`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo + Name */}
        <Link href={`/`} className="flex items-center gap-3">
          {store.logo ? (
            <img
              src={store.logo}
              alt={store.name}
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
            />
          ) : (
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${scheme.accent} text-sm font-bold`}>
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-lg font-bold">{store.name}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex">
          {store.settings.whatsapp && (
            <a
              href={`https://wa.me/${store.settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${scheme.textMuted} hover:bg-green-50 hover:text-green-600`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              <span className="hidden lg:inline">WhatsApp</span>
            </a>
          )}
          {store.settings.phone && (
            <a
              href={`tel:${store.settings.phone}`}
              aria-label={store.settings.phone}
              title={store.settings.phone}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${scheme.textMuted} hover:${scheme.bgCard}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="hidden lg:inline">{store.settings.phone}</span>
            </a>
          )}
          <CartButton scheme={scheme} t={t} />
        </nav>

        {/* Mobile: cart + burger */}
        <div className="flex items-center gap-2 sm:hidden">
          <CartButton scheme={scheme} t={t} />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`rounded-lg p-2 ${scheme.textMuted} hover:${scheme.bgCard}`}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={`border-t ${scheme.border} px-4 py-3 sm:hidden ${scheme.headerBg}`}>
          {store.settings.phone && (
            <a
              href={`tel:${store.settings.phone}`}
              className={`block py-2 text-sm ${scheme.textMuted}`}
            >
              Tel: {store.settings.phone}
            </a>
          )}
          {store.settings.address && (
            <p className={`py-2 text-sm ${scheme.textMuted}`}>
              {store.settings.address}
            </p>
          )}
          {store.settings.whatsapp && (
            <a
              href={`https://wa.me/${store.settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-2 text-sm text-green-600"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
    </header>
  );
}
