'use client';

import { useState, useRef } from 'react';
import type { ColorSchemeTokens } from '@/lib/types';
import type { ShopFrontMessages } from '@/lib/shop-i18n';

interface ShopNewsletterProps {
  storeId: string;
  scheme: ColorSchemeTokens;
  t: ShopFrontMessages;
}

export default function ShopNewsletter({ storeId, scheme, t }: ShopNewsletterProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), storeId }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {/* Mail icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h2 className={`text-2xl font-bold text-white sm:text-3xl ${scheme.headingFont || ''}`}>
            {t.newsletterTitle}
          </h2>
          <p className="mt-3 text-base text-gray-300">
            {t.newsletterDesc}
          </p>

          {/* Form */}
          {status === 'success' ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green-500/20 px-5 py-3 text-green-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t.newsletterSuccess}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.newsletterPlaceholder}
                required
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-gray-400 outline-none backdrop-blur-sm transition-colors focus:border-white/40 focus:ring-1 focus:ring-white/20 sm:max-w-xs"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className={`rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${scheme.accent} ${scheme.accentHover} disabled:opacity-50`}
              >
                {status === 'loading' ? (
                  <span className="inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                    </svg>
                    ...
                  </span>
                ) : (
                  t.newsletterButton
                )}
              </button>
            </form>
          )}

          {status === 'error' && (
            <p className="mt-3 text-sm text-red-400">
              {t.reviewError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
