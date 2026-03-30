'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';

interface SearchBarProps {
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function SearchBar({ scheme, t }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') || '';
  const [value, setValue] = useState(currentQuery);

  // Sync input with URL when navigating
  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  const updateSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) {
        params.set('q', q.trim());
        // Remove category when searching
        params.delete('category');
      } else {
        params.delete('q');
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ''}`);
    },
    [router, pathname, searchParams],
  );

  // Debounce: update URL 400ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== currentQuery) {
        updateSearch(value);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, currentQuery, updateSearch]);

  const handleClear = () => {
    setValue('');
    updateSearch('');
  };

  return (
    <div className="relative">
      {/* Search icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute left-4 top-1/2 -translate-y-1/2 ${scheme.textMuted}`}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.searchPlaceholder}
        className={`w-full rounded-full border ${scheme.border} ${scheme.bgCard} py-3 pl-11 pr-10 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-current/20 focus:shadow-md placeholder:${scheme.textMuted}`}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 ${scheme.textMuted} hover:opacity-70`}
          aria-label="Clear search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
