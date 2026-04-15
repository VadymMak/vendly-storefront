'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

const LOCALE_OPTIONS = [
  { code: 'sk', label: 'SK' },
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UK' },
  { code: 'cs', label: 'CS' },
  { code: 'de', label: 'DE' },
] as const;

interface AdminNavProps {
  userName?: string | null;
}

export default function AdminNav({ userName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();
  const tNav = useTranslations('dashboardNav');
  const tAdmin = useTranslations('admin');
  const [langOpen, setLangOpen] = useState(false);

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
    <header className="border-b border-red-200 bg-red-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo + admin badge */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white" />
                <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="font-bold text-secondary">VendShop</span>
          </Link>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            Admin
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link href="/admin"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === '/admin' ? 'bg-white text-red-700 shadow-sm' : 'text-red-600 hover:bg-white/60'
            }`}
          >
            {tAdmin('stores')}
          </Link>
          <Link href="/admin/users"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === '/admin/users' ? 'bg-white text-red-700 shadow-sm' : 'text-red-600 hover:bg-white/60'
            }`}
          >
            {tAdmin('users')}
          </Link>
          <Link href="/admin/leads"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === '/admin/leads' ? 'bg-white text-red-700 shadow-sm' : 'text-red-600 hover:bg-white/60'
            }`}
          >
            Leads
          </Link>
          <Link href="/dashboard"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-white/60 transition-colors"
          >
            ← Dashboard
          </Link>
        </nav>

        {/* Right side: locale + user */}
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1 7h12M7 1c1.7 1.7 2.7 3.7 2.7 6s-1 4.3-2.7 6c-1.7-1.7-2.7-3.7-2.7-6s1-4.3 2.7-6z" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="font-medium">{currentLocale.toUpperCase()}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2.5 3.75l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {LOCALE_OPTIONS.map((locale) => (
                  <button
                    key={locale.code}
                    onClick={() => switchLocale(locale.code)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                      currentLocale === locale.code ? 'font-semibold text-primary' : 'text-gray-700'
                    }`}
                  >
                    {locale.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="hidden text-sm text-gray-500 sm:block">
            {userName}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {tNav('logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
