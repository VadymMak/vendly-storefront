'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import CartButton from './CartButton';

interface ShopHeaderProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
}

export default function ShopHeader({ store, scheme }: ShopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-50 ${scheme.headerBg} ${scheme.border} border-b`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo + Name */}
        <Link href={`/shop/${store.slug}`} className="flex items-center gap-3">
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
        <nav className="hidden items-center gap-4 sm:flex">
          {store.settings.phone && (
            <a
              href={`tel:${store.settings.phone}`}
              className={`text-sm ${scheme.textMuted} hover:underline`}
            >
              {store.settings.phone}
            </a>
          )}
          <CartButton scheme={scheme} />
        </nav>

        {/* Mobile: cart + burger */}
        <div className="flex items-center gap-2 sm:hidden">
          <CartButton scheme={scheme} />
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
