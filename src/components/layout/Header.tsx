'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

const LOCALE_OPTIONS = [
  { code: 'sk', label: 'SK' },
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UK' },
  { code: 'cs', label: 'CS' },
  { code: 'de', label: 'DE' },
] as const;

const NAV_KEYS = [
  { key: 'features' as const, href: '#features' },
  { key: 'howItWorks' as const, href: '#how-it-works' },
  { key: 'pricing' as const, href: '#pricing' },
  { key: 'faq' as const, href: '#faq' },
];

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

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 7h12M7 1c1.7 1.7 2.7 3.7 2.7 6s-1 4.3-2.7 6c-1.7-1.7-2.7-3.7-2.7-6s1-4.3 2.7-6z" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.5 3.75l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="inline-flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#16a34a" />
            <text x="6" y="23" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white">V.</text>
          </svg>
          <span className="text-xl font-bold text-primary">Vendly</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_KEYS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-neutral transition-colors hover:text-secondary"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-neutral transition-colors hover:border-primary/30 hover:text-secondary cursor-pointer"
            >
              <GlobeIcon />
              <span>SK</span>
              <ChevronDownIcon />
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-1 w-24 animate-fade-in rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {LOCALE_OPTIONS.map((locale) => (
                  <button
                    key={locale.code}
                    onClick={() => setLangOpen(false)}
                    className="flex w-full items-center px-3 py-1.5 text-xs font-medium text-neutral transition-colors hover:bg-accent hover:text-primary cursor-pointer"
                  >
                    {locale.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button size="sm" href="#pricing">
            {t('cta')}
          </Button>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="inline-flex items-center justify-center text-secondary md:hidden cursor-pointer"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-fade-in border-t border-gray-100 bg-white px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_KEYS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral transition-colors hover:bg-accent hover:text-secondary"
              >
                {t(item.key)}
              </a>
            ))}
          </nav>

          {/* Mobile language pills */}
          <div className="mt-3 flex gap-1.5 px-3">
            {LOCALE_OPTIONS.map((locale) => (
              <button
                key={locale.code}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-neutral hover:border-primary/30 hover:text-primary cursor-pointer"
              >
                {locale.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Button size="sm" href="#pricing" className="w-full" onClick={() => setMenuOpen(false)}>
              {t('cta')}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
