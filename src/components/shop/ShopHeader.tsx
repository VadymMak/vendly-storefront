'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ShopData, ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';
import CartButton from './CartButton';

interface ShopHeaderProps {
  store: ShopData;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
  categories?: string[];
}

/** Smooth-scroll anchor link */
function NavAnchor({
  href,
  label,
  className,
  onClick,
}: {
  href: string;
  label: string;
  className: string;
  onClick?: () => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onClick?.();
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {label}
    </a>
  );
}

export default function ShopHeader({ store, scheme, t, categories = [] }: ShopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    if (catOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [catOpen]);

  const navLinks = [
    { href: '#products', label: t.navProducts },
    { href: '#reviews', label: t.navReviews },
    ...(store.settings.aboutText ? [{ href: '#about', label: t.navAbout }] : []),
    { href: '#contact', label: t.navContact },
  ];

  const navLinkClass = `text-sm font-medium transition-colors ${scheme.textMuted} hover:opacity-70`;

  return (
    <header className={`sticky top-0 z-50 ${scheme.headerBg} border-b ${scheme.border}`}>
      {/* ── Row 1: Logo + Section nav + Actions ────────────────────── */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo + Name */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {store.logo ? (
            <Image
              src={store.logo}
              alt={store.name}
              width={36}
              height={36}
              className="rounded-lg object-cover"
            />
          ) : (
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${scheme.accent} text-sm font-bold`}>
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-lg font-bold">{store.name}</span>
        </Link>

        {/* Desktop section nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          {navLinks.map((link) => (
            <NavAnchor
              key={link.href}
              href={link.href}
              label={link.label}
              className={navLinkClass}
            />
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 sm:flex">
          {store.settings.whatsapp && (
            <a
              href={`https://wa.me/${store.settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${scheme.textMuted} hover:text-green-600`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            </a>
          )}
          {store.settings.phone && (
            <a
              href={`tel:${store.settings.phone}`}
              aria-label={store.settings.phone}
              title={store.settings.phone}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${scheme.textMuted} hover:opacity-70`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          )}
          <CartButton scheme={scheme} t={t} />
        </div>

        {/* Mobile: cart + burger */}
        <div className="flex items-center gap-2 sm:hidden">
          <CartButton scheme={scheme} t={t} />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`rounded-lg p-2 ${scheme.textMuted}`}
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

      {/* ── Row 2: Category bar (desktop, when categories exist) ────── */}
      {categories.length > 1 && (
        <div className={`hidden sm:block border-t ${scheme.border}`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 py-2">
              {/* Category dropdown button */}
              <div ref={catRef} className="relative">
                <button
                  onClick={() => setCatOpen(!catOpen)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${scheme.chipBg} ${scheme.chipText} hover:opacity-80`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                  {t.allCategories}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${catOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown panel */}
                {catOpen && (
                  <div className={`absolute left-0 top-full mt-1 z-40 min-w-[200px] max-h-64 overflow-y-auto rounded-xl border ${scheme.border} ${scheme.headerBg} shadow-lg`}>
                    <Link
                      href="/"
                      onClick={() => setCatOpen(false)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-70 ${scheme.accent} rounded-t-xl`}
                    >
                      {t.allCategories}
                    </Link>
                    {categories.map((cat) => (
                      <Link
                        key={cat}
                        href={`/?category=${encodeURIComponent(cat)}`}
                        onClick={() => setCatOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${scheme.textMuted} hover:${scheme.bgCard}`}
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick category pills (show first few) */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {categories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat}
                    href={`/?category=${encodeURIComponent(cat)}`}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${scheme.chipBg} ${scheme.chipText} hover:opacity-80`}
                  >
                    {cat}
                  </Link>
                ))}
                {categories.length > 6 && (
                  <button
                    onClick={() => setCatOpen(true)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${scheme.chipBg} ${scheme.chipText} hover:opacity-80`}
                  >
                    +{categories.length - 6}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile menu ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className={`border-t ${scheme.border} px-4 py-3 sm:hidden ${scheme.headerBg}`}>
          {/* Section nav links */}
          <div className="flex flex-col gap-1 pb-3">
            {navLinks.map((link) => (
              <NavAnchor
                key={link.href}
                href={link.href}
                label={link.label}
                className={`block py-2 text-sm font-medium ${scheme.textMuted}`}
                onClick={() => setMenuOpen(false)}
              />
            ))}
          </div>

          {/* Category links in mobile */}
          {categories.length > 1 && (
            <div className={`border-t ${scheme.border} pt-3 pb-3`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${scheme.textMuted}`}>
                {t.allCategories}
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/?category=${encodeURIComponent(cat)}`}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${scheme.chipBg} ${scheme.chipText}`}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className={`border-t ${scheme.border} pt-3`}>
            {store.settings.phone && (
              <a href={`tel:${store.settings.phone}`} className={`block py-2 text-sm ${scheme.textMuted}`}>
                Tel: {store.settings.phone}
              </a>
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
        </div>
      )}
    </header>
  );
}
