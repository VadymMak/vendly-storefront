'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const LOCALE_OPTIONS = [
  { code: 'sk', label: 'SK' },
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UK' },
  { code: 'cs', label: 'CS' },
  { code: 'de', label: 'DE' },
] as const;

const NAV_KEYS = [
  { key: 'howItWorks' as const, href: '#how-it-works' },
  { key: 'features' as const, href: '#portfolio' },
  { key: 'pricing' as const, href: '/pricing' },
  { key: 'blog' as const, href: '/blog' },
  { key: 'faq' as const, href: '#testimonials' },
  { key: 'contact' as const, href: '/contact' },
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

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const t = useTranslations('nav');
  const currentLocale = useLocale();
  const router = useRouter();

  useEffect(() => {
    const THRESHOLD = 10;
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 20);
      if (Math.abs(currentY - lastScrollY.current) < THRESHOLD) return;
      setHidden(currentY > lastScrollY.current && currentY > 80);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const switchLocale = async (code: string) => {
    setLangOpen(false);
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    });
    router.refresh();
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${
        scrolled
          ? 'border-b border-white/10 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
      style={{ backgroundColor: scrolled ? 'rgba(11, 15, 26, 0.9)' : 'transparent' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="inline-flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#16a34a" />
            <text x="6" y="23" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white">V.</text>
          </svg>
          <span className="text-xl font-bold text-primary">VendShop</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_KEYS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[--color-text-muted] transition-colors hover:text-white"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[--color-text-muted] transition-colors hover:border-primary/40 hover:text-white cursor-pointer"
            >
              <GlobeIcon />
              <span>{currentLocale.toUpperCase()}</span>
              <ChevronDownIcon />
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-1 w-24 animate-fade-in rounded-lg border border-white/10 bg-[--color-card] py-1 shadow-lg">
                {LOCALE_OPTIONS.map((locale) => (
                  <button
                    key={locale.code}
                    onClick={() => switchLocale(locale.code)}
                    className={`flex w-full items-center px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      currentLocale === locale.code
                        ? 'bg-primary/15 text-primary'
                        : 'text-[--color-text-muted] hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {locale.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href="https://wa.me/421901234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <WhatsAppIcon />
            {t('cta')}
          </a>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="inline-flex items-center justify-center text-white md:hidden cursor-pointer"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-fade-in border-t border-white/10 bg-[--color-bg] px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_KEYS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[--color-text-muted] transition-colors hover:bg-white/5 hover:text-white"
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
                onClick={() => { switchLocale(locale.code); setMenuOpen(false); }}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                  currentLocale === locale.code
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-white/15 text-[--color-text-muted] hover:border-primary/40 hover:text-primary'
                }`}
              >
                {locale.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <a
              href="https://wa.me/421901234567"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <WhatsAppIcon />
              {t('cta')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
