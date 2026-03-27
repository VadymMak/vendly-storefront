'use client';

import { useState } from 'react';
import { SITE_NAME, NAV_ITEMS } from '@/lib/constants';
import Button from '@/components/ui/Button';

function BurgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="text-xl font-bold text-secondary">
          {SITE_NAME}
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-neutral transition-colors hover:text-secondary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button size="sm" href="#pricing">
            Začať zadarmo
          </Button>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="inline-flex items-center justify-center text-secondary md:hidden cursor-pointer"
          aria-label={menuOpen ? 'Zavrieť menu' : 'Otvoriť menu'}
        >
          {menuOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-fade-in border-t border-gray-100 bg-white px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral transition-colors hover:bg-accent hover:text-secondary"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-4">
            <Button size="sm" href="#pricing" className="w-full" onClick={() => setMenuOpen(false)}>
              Začať zadarmo
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
