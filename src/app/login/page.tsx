'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', { email, password, redirect: false });

    if (result?.error) {
      setError(t('errorInvalid'));
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <a href="/" className="inline-flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#16a34a" />
              <text x="6" y="23" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white">V.</text>
            </svg>
            <span className="text-2xl font-bold text-primary">Vendly</span>
          </a>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-bold text-secondary">{t('loginTitle')}</h1>
          <p className="mt-2 text-sm text-neutral">{t('loginSubtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-secondary">
                {t('email')}
              </label>
              <input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="vas@email.sk"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-secondary">
                {t('password')}
              </label>
              <input
                id="password" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min. 8 znakov"
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {loading ? '...' : t('loginButton')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral">
            {t('noAccount')}{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t('registerButton')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
